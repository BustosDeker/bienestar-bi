import { query, martPool, oltpPool, type Params } from './db.js';
import { dimConds, where, type Filters } from './filters.js';
import { estado, type Estado, type Umbral } from './semaforo.js';

export const KPI_IDS = ['KPI-01', 'KPI-02', 'KPI-03', 'KPI-04'] as const;
export type KpiId = (typeof KPI_IDS)[number];
export type Group = 'none' | 'ola' | 'week';

const JOIN_H = (key: string) => `JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
JOIN DimProgramaAcademico dp ON dp.KeyPrograma = h.KeyPrograma
JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo${key}`;

/**
 * Construye la consulta (T-SQL sobre el Data Mart) de cada KPI.
 * KPI-02/04 promedian sobre el calendario completo estudiante x semana (0 cuando no hay registros).
 */
export function kpiSql(id: KpiId, f: Filters, group: Group): { sql: string; params: Params } {
  const p: Params = {};
  const conds = dimConds(f, p);
  const grp = (expr: string) => (group === 'none' ? '' : `${expr} AS grupo,\n  `);
  const gby = (expr: string) => (group === 'none' ? '' : `\nGROUP BY ${expr}\nORDER BY ${expr}`);

  if (id === 'KPI-01') {
    const g = group === 'ola' ? 'dt.OlaMedicion' : 'dt.OlaMedicion';
    if (f.ola) { conds.push('dt.OlaMedicion = @ola'); p.ola = String(f.ola); }
    return {
      params: p,
      sql: `-- KPI-01: Nivel de satisfacción con la vida = Promedio(PuntajeSWLS), 5 a 35
SELECT ${grp(g)}AVG(CAST(h.PuntajeSWLS AS FLOAT)) AS valor,
  COUNT(DISTINCT h.KeyEstudiante) AS n
FROM Hecho_Bienestar h
${JOIN_H('')}
${where(conds)}${gby(g)}`,
    };
  }

  if (id === 'KPI-03') {
    const g = group === 'ola' ? 'so.Ola' : 'CONVERT(varchar(10), dt.InicioSemana, 23)';
    if (f.ola) { conds.push('so.Ola = @ola'); p.ola = f.ola; }
    return {
      params: p,
      sql: `-- KPI-03: Índice de calidad relacional = Promedio(ValoracionInteraccion), 1 a 5
SELECT ${grp(g)}AVG(h.ValoracionInteraccion) AS valor,
  COUNT(DISTINCT h.KeyEstudiante) AS n
FROM Hecho_Interaccion h
${JOIN_H('\nJOIN v_semana_ola so ON so.InicioSemana = dt.InicioSemana')}
${where(conds)}${gby(g)}`,
    };
  }

  // KPI-02 y KPI-04: calendario completo estudiante x semana
  const g = group === 'ola' ? 'so.Ola' : 'CONVERT(varchar(10), c.InicioSemana, 23)';
  if (f.ola) { conds.push('so.Ola = @ola'); p.ola = f.ola; }
  const sub =
    id === 'KPI-02'
      ? `SELECT h.KeyEstudiante, dt.InicioSemana, SUM(h.HorasSignificativas) AS x
  FROM Hecho_Interaccion h JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  GROUP BY h.KeyEstudiante, dt.InicioSemana`
      : `SELECT h.KeyEstudiante, dt.InicioSemana, COUNT(DISTINCT h.KeyTiempo) AS x   -- fechas distintas (no aditiva)
  FROM Hecho_Actividad h
  JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  JOIN DimActividad da ON da.KeyActividad = h.KeyActividad
  WHERE da.TipoActividad = N'Actividad física'
  GROUP BY h.KeyEstudiante, dt.InicioSemana`;
  const title =
    id === 'KPI-02'
      ? '-- KPI-02: Horas semanales de interacción significativa (valoración >= 4); semanas sin registros = 0'
      : '-- KPI-04: Días semanales de actividad física (0 a 7); semanas sin actividad = 0';
  return {
    params: p,
    sql: `${title}
WITH w AS (
  ${sub})
SELECT ${grp(g)}AVG(CAST(ISNULL(w.x, 0) AS FLOAT)) AS valor,
  COUNT(DISTINCT c.KeyEstudiante) AS n
FROM v_calendario c
JOIN DimEstudiante de ON de.KeyEstudiante = c.KeyEstudiante
JOIN DimProgramaAcademico dp ON dp.KeyPrograma = c.KeyPrograma
JOIN v_semana_ola so ON so.InicioSemana = c.InicioSemana
LEFT JOIN w ON w.KeyEstudiante = c.KeyEstudiante AND w.InicioSemana = c.InicioSemana
${where(conds)}${gby(g)}`,
  };
}

let cfgCache: { at: number; data: Record<string, Umbral & { nombre: string }> } | null = null;
export async function getConfig() {
  if (cfgCache && Date.now() - cfgCache.at < 60_000) return cfgCache.data;
  const r = await query(oltpPool, 'SELECT kpi, nombre, umbral_bueno, umbral_regular FROM CONFIG_KPI');
  const data: Record<string, Umbral & { nombre: string }> = {};
  for (const x of r.rows) data[x.kpi] = { nombre: x.nombre, umbral_bueno: Number(x.umbral_bueno), umbral_regular: Number(x.umbral_regular) };
  cfgCache = { at: Date.now(), data };
  return data;
}

export interface KpiResult {
  id: KpiId;
  nombre: string;
  valor: number | null;
  n: number;
  estado: Estado | null;
  umbral: Umbral;
  variacion: number | null;
  byOla: { grupo: string; valor: number; n: number }[];
  series: { grupo: string; valor: number }[];
  suppressed?: boolean;
}

export async function computeKpi(id: KpiId, f: Filters): Promise<KpiResult & { queries: { label: string; sql: string; ms: number }[] }> {
  const cfg = (await getConfig())[id];
  const a = kpiSql(id, f, 'none');
  const b = kpiSql(id, f, 'ola');
  const c = id === 'KPI-01' ? b : kpiSql(id, f, 'week');
  const [ra, rb, rc] = await Promise.all([query(martPool, a.sql, a.params), query(martPool, b.sql, b.params), id === 'KPI-01' ? null : query(martPool, c.sql, c.params)]);
  const byOla = rb.rows.filter((r) => r.grupo !== null).map((r) => ({ grupo: String(r.grupo), valor: Number(r.valor), n: Number(r.n) }));
  const series = (rc ?? rb).rows.filter((r) => r.grupo !== null).map((r) => ({ grupo: String(r.grupo), valor: Number(r.valor) }));
  const row = ra.rows[0] ?? {};
  const valor = row.valor === null || row.valor === undefined ? null : Number(row.valor);
  const n = Number(row.n ?? 0);
  const variacion = byOla.length >= 2 ? byOla[byOla.length - 1].valor - byOla[byOla.length - 2].valor : null;
  const umbral = { umbral_bueno: cfg.umbral_bueno, umbral_regular: cfg.umbral_regular };
  const queries = [{ label: 'Valor', sql: ra.sql, ms: ra.ms }, { label: 'Por ola', sql: rb.sql, ms: rb.ms }];
  if (rc) queries.push({ label: 'Por semana', sql: rc.sql, ms: rc.ms });
  return { id, nombre: cfg.nombre, valor, n, estado: estado(valor, umbral), umbral, variacion, byOla, series, queries };
}
