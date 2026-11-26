import { query, martPool, type Params } from './db.js';
import { dimConds, where, type Filters } from './filters.js';
import { applyK } from './kanon.js';
import { estado } from './semaforo.js';
import { getConfig } from './kpi.js';

export interface ReportDef {
  n: number;
  /** columnas esperadas por el diseño del informe (para la insignia "validado") */
  design: string[];
  values: string[];
  build: (f: Filters) => { sql: string; params: Params };
}

const CAL = `FROM v_calendario c
JOIN DimEstudiante de ON de.KeyEstudiante = c.KeyEstudiante
JOIN DimProgramaAcademico dp ON dp.KeyPrograma = c.KeyPrograma
JOIN v_semana_ola so ON so.InicioSemana = c.InicioSemana`;

function weekly(f: Filters, p: Params) {
  const c = dimConds(f, p);
  if (f.ola) { c.push('so.Ola = @ola'); p.ola = f.ola; }
  return c;
}
function surveyConds(f: Filters, p: Params) {
  const c = dimConds(f, p);
  if (f.ola) { c.push('dt.OlaMedicion = @ola'); p.ola = String(f.ola); }
  return c;
}

export const REPORTS: ReportDef[] = [
  {
    n: 1,
    design: ['Facultad', 'Escuela', 'RangoEdad', 'Estudiantes', 'valor'],
    values: ['valor'],
    build(f) {
      const p: Params = {};
      const c = surveyConds(f, p);
      return {
        params: p,
        sql: `-- R1: SWLS por escuela (subtotal por facultad) y rango de edad
SELECT Facultad = CASE WHEN GROUPING(dp.Facultad) = 1 THEN N'TOTAL' ELSE dp.Facultad END,
  Escuela = CASE WHEN GROUPING(dp.Escuela) = 1 THEN N'(subtotal)' ELSE dp.Escuela END,
  de.RangoEdad,
  Estudiantes = COUNT(DISTINCT h.KeyEstudiante),
  n = COUNT(DISTINCT h.KeyEstudiante),
  valor = AVG(CAST(h.PuntajeSWLS AS FLOAT)),
  nivel = GROUPING(dp.Facultad) * 4 + GROUPING(dp.Escuela) * 2 + GROUPING(de.RangoEdad)
FROM Hecho_Bienestar h
JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
JOIN DimProgramaAcademico dp ON dp.KeyPrograma = h.KeyPrograma
JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
${where(c)}
GROUP BY GROUPING SETS ((dp.Facultad, dp.Escuela, de.RangoEdad), (dp.Facultad, dp.Escuela), (dp.Facultad), ())
ORDER BY GROUPING(dp.Facultad), dp.Facultad, GROUPING(dp.Escuela), dp.Escuela, de.RangoEdad`,
      };
    },
  },
  {
    n: 2,
    design: ['TipoVinculo', 'Modalidad', 'RangoEdad', 'valor'],
    values: ['valor'],
    build(f) {
      const p: Params = {};
      const c = weekly(f, p);
      return {
        params: p,
        sql: `-- R2: horas semanales significativas por vínculo y modalidad x rango de edad
WITH h AS (
  SELECT h.KeyEstudiante, dt.InicioSemana, di.TipoVinculo, di.Modalidad, SUM(h.HorasSignificativas) AS x
  FROM Hecho_Interaccion h
  JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  JOIN DimInteraccionSocial di ON di.KeyInteraccion = h.KeyInteraccion
  GROUP BY h.KeyEstudiante, dt.InicioSemana, di.TipoVinculo, di.Modalidad),
tipos AS (SELECT DISTINCT TipoVinculo, Modalidad FROM DimInteraccionSocial)
SELECT t.TipoVinculo, t.Modalidad, de.RangoEdad,
  n = COUNT(DISTINCT c.KeyEstudiante),
  valor = AVG(CAST(ISNULL(h.x, 0) AS FLOAT))
${CAL}
CROSS JOIN tipos t
LEFT JOIN h ON h.KeyEstudiante = c.KeyEstudiante AND h.InicioSemana = c.InicioSemana
           AND h.TipoVinculo = t.TipoVinculo AND h.Modalidad = t.Modalidad
${where(c)}
GROUP BY t.TipoVinculo, t.Modalidad, de.RangoEdad
ORDER BY t.TipoVinculo, t.Modalidad, de.RangoEdad`,
      };
    },
  },
  {
    n: 3,
    design: ['TipoActividad', 'RangoEdad', 'valor'],
    values: ['valor'],
    build(f) {
      const p: Params = {};
      const c = weekly(f, p);
      return {
        params: p,
        sql: `-- R3: días semanales de actividad física y de autocuidado x rango de edad
WITH d AS (
  SELECT h.KeyEstudiante, dt.InicioSemana, da.TipoActividad, COUNT(DISTINCT h.KeyTiempo) AS x
  FROM Hecho_Actividad h
  JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  JOIN DimActividad da ON da.KeyActividad = h.KeyActividad
  GROUP BY h.KeyEstudiante, dt.InicioSemana, da.TipoActividad),
tipos AS (SELECT DISTINCT TipoActividad FROM DimActividad)
SELECT t.TipoActividad, de.RangoEdad,
  n = COUNT(DISTINCT c.KeyEstudiante),
  valor = AVG(CAST(ISNULL(d.x, 0) AS FLOAT))
${CAL}
CROSS JOIN tipos t
LEFT JOIN d ON d.KeyEstudiante = c.KeyEstudiante AND d.InicioSemana = c.InicioSemana AND d.TipoActividad = t.TipoActividad
${where(c)}
GROUP BY t.TipoActividad, de.RangoEdad
ORDER BY t.TipoActividad, de.RangoEdad`,
      };
    },
  },
  {
    n: 4,
    design: ['OlaMedicion', 'valor', 'Variacion', 'Estado'],
    values: ['valor', 'Variacion'],
    build(f) {
      const p: Params = {};
      const c = dimConds(f, p);
      return {
        params: p,
        sql: `-- R4: evolución del SWLS por ola, con variación (LAG) y estado
WITH o AS (
  SELECT dt.OlaMedicion, valor = AVG(CAST(h.PuntajeSWLS AS FLOAT)), n = COUNT(DISTINCT h.KeyEstudiante)
  FROM Hecho_Bienestar h
  JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
  JOIN DimProgramaAcademico dp ON dp.KeyPrograma = h.KeyPrograma
  JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  ${where(c)}
  GROUP BY dt.OlaMedicion)
SELECT OlaMedicion, valor, n, Variacion = valor - LAG(valor) OVER (ORDER BY OlaMedicion)
FROM o ORDER BY OlaMedicion`,
      };
    },
  },
  {
    n: 5,
    design: ['Bloque', 'Sexo', 'Grupo', 'valor'],
    values: ['valor'],
    build(f) {
      const p: Params = {};
      const c = weekly(f, p);
      const w = where(c);
      return {
        params: p,
        sql: `-- R5: valoración de interacciones e intensidad de actividad por sexo
SELECT Bloque = N'Valoración por vínculo', de.Sexo, Grupo = di.TipoVinculo,
  n = COUNT(DISTINCT h.KeyEstudiante), valor = AVG(h.ValoracionInteraccion)
FROM Hecho_Interaccion h
JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
JOIN DimProgramaAcademico dp ON dp.KeyPrograma = h.KeyPrograma
JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
JOIN v_semana_ola so ON so.InicioSemana = dt.InicioSemana
JOIN DimInteraccionSocial di ON di.KeyInteraccion = h.KeyInteraccion
${w}
GROUP BY de.Sexo, di.TipoVinculo
UNION ALL
SELECT N'Minutos por intensidad', de.Sexo, da.Intensidad,
  COUNT(DISTINCT h.KeyEstudiante), AVG(CAST(h.MinutosActividad AS FLOAT))
FROM Hecho_Actividad h
JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
JOIN DimProgramaAcademico dp ON dp.KeyPrograma = h.KeyPrograma
JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
JOIN v_semana_ola so ON so.InicioSemana = dt.InicioSemana
JOIN DimActividad da ON da.KeyActividad = h.KeyActividad
${w}
GROUP BY de.Sexo, da.Intensidad
ORDER BY 1, 2, 3`,
      };
    },
  },
  {
    n: 6,
    design: ['Mes', 'Semana', 'InicioSemana', 'HorasPorEstudiante', 'Valoracion', 'DiasActividadFisica'],
    values: ['HorasPorEstudiante', 'Valoracion', 'DiasActividadFisica'],
    build(f) {
      const p: Params = {};
      const c = weekly(f, p);
      return {
        params: p,
        sql: `-- R6: seguimiento semanal por mes
WITH i AS (
  SELECT h.KeyEstudiante, dt.InicioSemana, SUM(h.HorasSignificativas) AS horas, AVG(h.ValoracionInteraccion) AS val
  FROM Hecho_Interaccion h JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  GROUP BY h.KeyEstudiante, dt.InicioSemana),
a AS (
  SELECT h.KeyEstudiante, dt.InicioSemana, COUNT(DISTINCT h.KeyTiempo) AS dias
  FROM Hecho_Actividad h JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  JOIN DimActividad da ON da.KeyActividad = h.KeyActividad AND da.TipoActividad = N'Actividad física'
  GROUP BY h.KeyEstudiante, dt.InicioSemana)
SELECT lun.Mes, lun.Semana, InicioSemana = CONVERT(varchar(10), c.InicioSemana, 23),
  n = COUNT(DISTINCT c.KeyEstudiante),
  HorasPorEstudiante = AVG(CAST(ISNULL(i.horas, 0) AS FLOAT)),
  Valoracion = AVG(i.val),
  DiasActividadFisica = AVG(CAST(ISNULL(a.dias, 0) AS FLOAT))
${CAL}
JOIN DimTiempo lun ON lun.idfecha = c.InicioSemana
LEFT JOIN i ON i.KeyEstudiante = c.KeyEstudiante AND i.InicioSemana = c.InicioSemana
LEFT JOIN a ON a.KeyEstudiante = c.KeyEstudiante AND a.InicioSemana = c.InicioSemana
${where(c)}
GROUP BY c.InicioSemana, lun.Mes, lun.Semana
ORDER BY c.InicioSemana`,
      };
    },
  },
  {
    n: 7,
    design: ['CicloEstudios', 'RangoIngreso', 'Estudiantes', 'valor'],
    values: ['valor'],
    build(f) {
      const p: Params = {};
      const c = surveyConds(f, p);
      return {
        params: p,
        sql: `-- R7: SWLS por ciclo de estudios y rango de ingreso
SELECT de.CicloEstudios, de.RangoIngreso,
  Estudiantes = COUNT(DISTINCT h.KeyEstudiante), n = COUNT(DISTINCT h.KeyEstudiante),
  valor = AVG(CAST(h.PuntajeSWLS AS FLOAT))
FROM Hecho_Bienestar h
JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
JOIN DimProgramaAcademico dp ON dp.KeyPrograma = h.KeyPrograma
JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
${where(c)}
GROUP BY de.CicloEstudios, de.RangoIngreso
ORDER BY de.CicloEstudios, de.RangoIngreso`,
      };
    },
  },
];

export async function runReport(n: number, f: Filters) {
  const def = REPORTS.find((r) => r.n === n);
  if (!def) return null;
  const { sql, params } = def.build(f);
  const r = await query(martPool, sql, params);
  let rows: any[] = r.rows;
  if (n === 4) {
    const cfg = (await getConfig())['KPI-01'];
    rows = rows.map((x) => ({ ...x, Estado: estado(x.valor, cfg) }));
  }
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const validated = def.design.every((c) => cols.includes(c)) || rows.length === 0;
  rows = applyK(rows, f.k, 'n', def.values);
  return {
    n,
    columns: cols.filter((c) => c !== 'n' && c !== 'nivel'),
    rows,
    sql: r.sql,
    ms: r.ms,
    validated,
    design: def.design,
    k: f.k,
  };
}
