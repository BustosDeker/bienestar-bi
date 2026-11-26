import { z } from 'zod';
import { query, martPool, type Params } from './db.js';
import { dimConds, filtersSchema, where } from './filters.js';
import { applyK } from './kanon.js';

type Fact = 'bienestar' | 'interaccion' | 'actividad';

export const MEASURES: Record<string, { fact: Fact; table: string; expr: string; label: string }> = {
  PuntajeSWLS: { fact: 'bienestar', table: 'Hecho_Bienestar', expr: 'AVG(CAST(h.PuntajeSWLS AS FLOAT))', label: 'Puntaje SWLS (promedio)' },
  HorasSignificativas: { fact: 'interaccion', table: 'Hecho_Interaccion', expr: 'SUM(h.HorasSignificativas) / NULLIF(COUNT(DISTINCT h.KeyEstudiante), 0) / NULLIF(COUNT(DISTINCT dt.InicioSemana), 0)', label: 'Horas significativas por estudiante y semana' },
  ValoracionInteraccion: { fact: 'interaccion', table: 'Hecho_Interaccion', expr: 'AVG(h.ValoracionInteraccion)', label: 'Valoración de interacción (promedio)' },
  MinutosActividad: { fact: 'actividad', table: 'Hecho_Actividad', expr: 'SUM(CAST(h.MinutosActividad AS FLOAT)) / NULLIF(COUNT(DISTINCT h.KeyEstudiante), 0) / NULLIF(COUNT(DISTINCT dt.InicioSemana), 0)', label: 'Minutos de actividad por estudiante y semana' },
  DiasActividad: { fact: 'actividad', table: 'Hecho_Actividad', expr: 'COUNT(DISTINCT CONCAT(h.KeyEstudiante, N\'-\', h.KeyTiempo)) * 1.0 / NULLIF(COUNT(DISTINCT h.KeyEstudiante), 0) / NULLIF(COUNT(DISTINCT dt.InicioSemana), 0)', label: 'Días con actividad por estudiante y semana' },
};

const ALL: Fact[] = ['bienestar', 'interaccion', 'actividad'];
export const DIMS: Record<string, { expr: string; facts: Fact[]; time?: boolean; label: string }> = {
  Facultad: { expr: 'dp.Facultad', facts: ALL, label: 'Facultad' },
  Escuela: { expr: 'dp.Escuela', facts: ALL, label: 'Escuela' },
  RangoEdad: { expr: 'de.RangoEdad', facts: ALL, label: 'Rango de edad' },
  Sexo: { expr: 'de.Sexo', facts: ALL, label: 'Sexo' },
  CicloEstudios: { expr: 'de.CicloEstudios', facts: ALL, label: 'Ciclo de estudios' },
  RangoIngreso: { expr: 'de.RangoIngreso', facts: ALL, label: 'Rango de ingreso' },
  Anual: { expr: 'dt.Anual', facts: ALL, time: true, label: 'Año' },
  Mes: { expr: 'dt.Mes', facts: ALL, time: true, label: 'Mes' },
  Semana: { expr: 'CONVERT(varchar(10), dt.InicioSemana, 23)', facts: ALL, time: true, label: 'Semana' },
  Dia: { expr: 'CONVERT(varchar(10), dt.idfecha, 23)', facts: ALL, time: true, label: 'Día' },
  OlaMedicion: { expr: 'dt.OlaMedicion', facts: ['bienestar'], label: 'Ola de medición' },
  PeriodoAcademico: { expr: 'dt.PeriodoAcademico', facts: ALL, label: 'Periodo académico' },
  TipoVinculo: { expr: 'di.TipoVinculo', facts: ['interaccion'], label: 'Tipo de vínculo' },
  Modalidad: { expr: 'di.Modalidad', facts: ['interaccion'], label: 'Modalidad' },
  TipoActividad: { expr: 'da.TipoActividad', facts: ['actividad'], label: 'Tipo de actividad' },
  Intensidad: { expr: 'da.Intensidad', facts: ['actividad'], label: 'Intensidad' },
  Actividad: { expr: 'da.Actividad', facts: ['actividad'], label: 'Actividad' },
};

export const HIERARCHIES = [
  { name: 'Programa', levels: ['Facultad', 'Escuela'] },
  { name: 'Tiempo', levels: ['Anual', 'Mes', 'Semana', 'Dia'] },
];

const dimName = z.string().refine((d) => d in DIMS, 'dimensión desconocida');
export const exploreSchema = z.object({
  measure: z.string().refine((m) => m in MEASURES, 'medida desconocida'),
  rows: z.array(dimName).max(3).default([]),
  cols: z.array(dimName).max(2).default([]),
  filters: filtersSchema.default({}),
  slicers: z.record(dimName, z.array(z.string().max(100)).max(30)).default({}),
  drill: z.record(dimName, z.string().max(100)).default({}),
});
export type ExploreReq = z.infer<typeof exploreSchema>;

export async function explore(req: ExploreReq) {
  const m = MEASURES[req.measure];
  const dims = [...new Set([...req.rows, ...req.cols])];
  const bad = [...dims, ...Object.keys(req.drill), ...Object.keys(req.slicers)].filter((d) => !DIMS[d].facts.includes(m.fact));
  if (bad.length) throw Object.assign(new Error(`Las dimensiones ${bad.join(', ')} no aplican a la medida ${req.measure}`), { status: 422 });

  const p: Params = {};
  const conds = dimConds(req.filters, p);
  if (req.filters.ola) {
    if (m.fact === 'bienestar') { conds.push('dt.OlaMedicion = @ola'); p.ola = String(req.filters.ola); }
    else { conds.push('so.Ola = @ola'); p.ola = req.filters.ola; }
  }
  let i = 0;
  for (const [d, v] of Object.entries(req.drill)) { conds.push(`${DIMS[d].expr} = @d${i}`); p[`d${i++}`] = v; }
  for (const [d, vs] of Object.entries(req.slicers)) {
    if (!vs.length) continue;
    const names = vs.map((v) => { const n = `s${i++}`; p[n] = v; return '@' + n; });
    conds.push(`${DIMS[d].expr} IN (${names.join(', ')})`);
  }
  const needsDi = dims.concat(Object.keys(req.drill), Object.keys(req.slicers)).some((d) => ['TipoVinculo', 'Modalidad'].includes(d));
  const needsDa = dims.concat(Object.keys(req.drill), Object.keys(req.slicers)).some((d) => ['TipoActividad', 'Intensidad', 'Actividad'].includes(d));
  const timeDims = dims.some((d) => DIMS[d].time);
  const select = dims.map((d) => `${DIMS[d].expr} AS [${d}]`).join(',\n  ');
  const gb = dims.map((d) => DIMS[d].expr);
  const sql = `-- Explorador: ${m.label}
SELECT TOP (2000)${select ? '\n  ' + select + ',' : ''}
  ${m.expr} AS valor,
  COUNT(DISTINCT h.KeyEstudiante) AS n
FROM ${m.table} h
JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
JOIN DimProgramaAcademico dp ON dp.KeyPrograma = h.KeyPrograma
JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo${req.filters.ola && m.fact !== 'bienestar' ? '\nJOIN v_semana_ola so ON so.InicioSemana = dt.InicioSemana' : ''}${needsDi ? '\nJOIN DimInteraccionSocial di ON di.KeyInteraccion = h.KeyInteraccion' : ''}${needsDa ? '\nJOIN DimActividad da ON da.KeyActividad = h.KeyActividad' : ''}
${where(conds)}${gb.length ? '\nGROUP BY ' + gb.join(', ') : ''}${gb.length ? '\nORDER BY ' + (timeDims ? 'MIN(dt.idfecha), ' : '') + gb.join(', ') : ''}`;
  const r = await query(martPool, sql, p);
  return { measure: req.measure, label: m.label, dims, rows: applyK(r.rows.map((x) => ({ ...x, valor: x.valor === null ? null : Number(x.valor) })), req.filters.k), sql: r.sql, ms: r.ms, k: req.filters.k };
}
