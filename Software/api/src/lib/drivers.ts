import { query, martPool, type Params } from './db.js';
import { dimConds, where, type Filters } from './filters.js';
import { applyK } from './kanon.js';
import { spearman } from './stats.js';

export const DRIVER_VARS = ['HorasSignificativas', 'ValoracionInteraccion', 'DiasActividad', 'MinutosActividad', 'PuntajeSWLS', 'VariacionPuntajeSWLS'] as const;

const SWLS_CTES = `swls AS (
  SELECT h.KeyEstudiante, AVG(CAST(h.PuntajeSWLS AS FLOAT)) AS swls
  FROM Hecho_Bienestar h GROUP BY h.KeyEstudiante),
sv AS (
  SELECT KeyEstudiante, v = MAX(CASE WHEN rd = 1 THEN p END) - MAX(CASE WHEN ra = 1 THEN p END)
  FROM (SELECT h.KeyEstudiante, p = h.PuntajeSWLS,
          ra = ROW_NUMBER() OVER (PARTITION BY h.KeyEstudiante ORDER BY dt.OlaMedicion),
          rd = ROW_NUMBER() OVER (PARTITION BY h.KeyEstudiante ORDER BY dt.OlaMedicion DESC),
          c = COUNT(*) OVER (PARTITION BY h.KeyEstudiante)
        FROM Hecho_Bienestar h JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo) q
  WHERE c >= 2 GROUP BY KeyEstudiante)`;

function ranking(kind: 'vinculo' | 'actividad', f: Filters) {
  const p: Params = {};
  const c = dimConds(f, p);
  const isV = kind === 'vinculo';
  const grupo = isV ? 'di.TipoVinculo' : 'da.Actividad';
  const medida = isV ? 'SUM(h.HorasSignificativas)' : 'SUM(CAST(h.MinutosActividad AS FLOAT))';
  const val = isV ? 'AVG(h.ValoracionInteraccion)' : 'CAST(NULL AS FLOAT)';
  const from = isV
    ? 'Hecho_Interaccion h JOIN DimInteraccionSocial di ON di.KeyInteraccion = h.KeyInteraccion'
    : 'Hecho_Actividad h JOIN DimActividad da ON da.KeyActividad = h.KeyActividad';
  const sql = `-- Drivers (${kind}): ranking descriptivo; difSWLS = SWLS medio de la mitad con mas ${isV ? 'horas' : 'minutos'} menos la mitad con menos
WITH ${SWLS_CTES},
x AS (
  SELECT h.KeyEstudiante, grupo = ${grupo}, cantidad = ${medida}, val = ${val}
  FROM ${from}
  JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
  JOIN DimProgramaAcademico dp ON dp.KeyPrograma = h.KeyPrograma
  ${where(c)}
  GROUP BY h.KeyEstudiante, ${grupo}),
y AS (
  SELECT x.*, s.swls, v.v, mitad = NTILE(2) OVER (PARTITION BY x.grupo ORDER BY x.cantidad)
  FROM x JOIN swls s ON s.KeyEstudiante = x.KeyEstudiante
  LEFT JOIN sv v ON v.KeyEstudiante = x.KeyEstudiante),
sem AS (SELECT COUNT(DISTINCT InicioSemana) AS n FROM v_calendario)
SELECT grupo, n = COUNT(*),
  valoracion = AVG(val),
  cantidadSemanal = AVG(cantidad) / MAX(sem.n),
  variacionSWLS = AVG(v),
  difSWLS = AVG(CASE WHEN mitad = 2 THEN swls END) - AVG(CASE WHEN mitad = 1 THEN swls END)
FROM y CROSS JOIN sem
GROUP BY grupo ORDER BY difSWLS DESC`;
  return { sql, p };
}

export async function drivers(f: Filters) {
  const rv = ranking('vinculo', f);
  const ra = ranking('actividad', f);
  const p: Params = {};
  const c = dimConds(f, p);
  const studentSql = `-- Drivers: base a nivel estudiante (para Spearman y dispersión)
WITH ${SWLS_CTES},
sem AS (SELECT COUNT(DISTINCT InicioSemana) AS n FROM v_calendario),
hi AS (SELECT KeyEstudiante, horas = SUM(HorasSignificativas), val = AVG(ValoracionInteraccion) FROM Hecho_Interaccion GROUP BY KeyEstudiante),
ha AS (
  SELECT h.KeyEstudiante, dias = COUNT(DISTINCT h.KeyTiempo), minutos = SUM(CAST(h.MinutosActividad AS FLOAT))
  FROM Hecho_Actividad h JOIN DimActividad da ON da.KeyActividad = h.KeyActividad
  GROUP BY h.KeyEstudiante)
SELECT de.KeyEstudiante,
  HorasSignificativas = hi.horas / sem.n, ValoracionInteraccion = hi.val,
  DiasActividad = CAST(ISNULL(ha.dias, 0) AS FLOAT) / sem.n, MinutosActividad = ISNULL(ha.minutos, 0) / sem.n,
  PuntajeSWLS = s.swls, VariacionPuntajeSWLS = v.v
FROM DimEstudiante de
JOIN v_estudiante_programa ep ON ep.KeyEstudiante = de.KeyEstudiante
JOIN DimProgramaAcademico dp ON dp.KeyPrograma = ep.KeyPrograma
CROSS JOIN sem
JOIN swls s ON s.KeyEstudiante = de.KeyEstudiante
JOIN hi ON hi.KeyEstudiante = de.KeyEstudiante
LEFT JOIN ha ON ha.KeyEstudiante = de.KeyEstudiante
LEFT JOIN sv v ON v.KeyEstudiante = de.KeyEstudiante
${where(c)}`;
  const [a, b, s] = await Promise.all([query(martPool, rv.sql, rv.p), query(martPool, ra.sql, ra.p), query(martPool, studentSql, p)]);
  const students = s.rows.map((r) => Object.fromEntries(DRIVER_VARS.map((k) => [k, r[k] === null ? null : Number(r[k])])) as Record<(typeof DRIVER_VARS)[number], number | null>);
  const n = students.length;
  const suppressed = n < f.k;
  const matrix = DRIVER_VARS.map((x) =>
    DRIVER_VARS.map((y) => {
      if (suppressed) return null;
      const pairs = students.filter((r) => r[x] !== null && r[y] !== null);
      return spearman(pairs.map((r) => r[x]!), pairs.map((r) => r[y]!));
    }),
  );
  const num = (r: any, keys: string[]) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, r[k] === null ? null : Number(r[k])])) });
  const keys = ['valoracion', 'cantidadSemanal', 'variacionSWLS', 'difSWLS'];
  return {
    n, suppressed, k: f.k, vars: DRIVER_VARS, matrix,
    vinculos: applyK(a.rows.map((r) => num(r, keys)), f.k, 'n', keys),
    actividades: applyK(b.rows.map((r) => num(r, keys)), f.k, 'n', keys),
    scatter: suppressed ? [] : students.filter((r) => r.HorasSignificativas !== null).map((r) => ({ x: r.HorasSignificativas, y: r.PuntajeSWLS, d: r.DiasActividad })),
    queries: [{ label: 'Vínculos', sql: a.sql, ms: a.ms }, { label: 'Actividades', sql: b.sql, ms: b.ms }, { label: 'Base estudiante', sql: s.sql, ms: s.ms }],
  };
}
