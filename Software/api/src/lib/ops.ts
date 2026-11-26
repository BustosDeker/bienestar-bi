import sql from 'mssql';
import { z } from 'zod';
import { config } from '../config.js';
import { etlPool, martPool, oltpPool, query } from './db.js';
import { DIMS, HIERARCHIES, MEASURES } from './explore.js';
import { getConfig } from './kpi.js';

const today = () => new Date().toISOString().slice(0, 10);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(Date.parse(d)), 'fecha inválida');
const cod = z.coerce.number().int().positive();

export const surveySchema = z.object({
  cod_estudiante: cod,
  fecha: fecha.default(today),
  respuestas: z.array(z.number().int().min(1).max(7)).length(5),
});
export const interactionSchema = z.object({
  cod_estudiante: cod,
  id_vinculo: z.number().int().positive(),
  id_modalidad: z.number().int().positive(),
  fecha: fecha.default(today),
  duracion_horas: z.number().gt(0).lte(24),
  valoracion: z.number().int().min(1).max(5),
});
export const activitySchema = z.object({
  cod_estudiante: cod,
  id_actividad: z.number().int().positive(),
  fecha: fecha.default(today),
  duracion_min: z.number().int().gt(0).lte(600),
});

const httpErr = (status: number, message: string) => Object.assign(new Error(message), { status });
function mapSqlError(e: any): never {
  if (e?.number === 2627 || e?.number === 2601) throw httpErr(409, 'Ya existe un registro para ese estudiante en esa ola');
  if (e?.number === 547) throw httpErr(422, 'Estudiante o catálogo inexistente, o valor fuera de rango');
  throw e;
}

export async function logSurvey(b: z.infer<typeof surveySchema>) {
  const pool = await oltpPool();
  const ola = await query(oltpPool, 'SELECT id_ola, numero FROM OLA_MEDICION WHERE @f BETWEEN fecha_inicio AND fecha_fin', { f: b.fecha });
  if (!ola.rows[0]) throw httpErr(422, 'La fecha indicada no está dentro de una ola de medición');
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const r = await new sql.Request(tx)
      .input('c', b.cod_estudiante).input('o', ola.rows[0].id_ola).input('f', b.fecha)
      .query('INSERT INTO ENCUESTA_BIENESTAR (cod_estudiante, id_ola, fecha_aplicacion) OUTPUT INSERTED.id_encuesta VALUES (@c, @o, @f)');
    const id = r.recordset[0].id_encuesta as number;
    for (let i = 0; i < 5; i++) {
      await new sql.Request(tx).input('e', id).input('n', i + 1).input('v', b.respuestas[i])
        .query('INSERT INTO RESPUESTA_SWLS (id_encuesta, id_item, valor) SELECT @e, id_item, @v FROM ITEM_SWLS WHERE numero = @n');
    }
    await tx.commit();
    return { id_encuesta: id, ola: ola.rows[0].numero as number, puntaje: b.respuestas.reduce((a, c) => a + c, 0) };
  } catch (e) {
    await tx.rollback().catch(() => undefined);
    return mapSqlError(e);
  }
}

export async function logInteraction(b: z.infer<typeof interactionSchema>) {
  const t = await query(oltpPool, 'SELECT id_tipo_inter FROM TIPO_INTERACCION WHERE id_vinculo = @v AND id_modalidad = @m', { v: b.id_vinculo, m: b.id_modalidad });
  if (!t.rows[0]) throw httpErr(422, 'Combinación de vínculo y modalidad inexistente');
  try {
    const r = await query(oltpPool, 'INSERT INTO REGISTRO_INTERACCION (cod_estudiante, id_tipo_inter, fecha, duracion_horas, valoracion) OUTPUT INSERTED.id_registro VALUES (@c, @t, @f, @d, @v)',
      { c: b.cod_estudiante, t: t.rows[0].id_tipo_inter, f: b.fecha, d: b.duracion_horas, v: b.valoracion });
    return { id_registro: r.rows[0].id_registro as number };
  } catch (e) { return mapSqlError(e); }
}

export async function logActivity(b: z.infer<typeof activitySchema>) {
  try {
    const r = await query(oltpPool, 'INSERT INTO REGISTRO_ACTIVIDAD (cod_estudiante, id_actividad, fecha, duracion_min) OUTPUT INSERTED.id_registro VALUES (@c, @a, @f, @d)',
      { c: b.cod_estudiante, a: b.id_actividad, f: b.fecha, d: b.duracion_min });
    return { id_registro: r.rows[0].id_registro as number, cuenta_para_kpi: b.duracion_min >= 10 };
  } catch (e) { return mapSqlError(e); }
}

/* ---------------- ETL ---------------- */
const ETL_STEPS = [
  { paso: 'Dimensiones', proc: 'usp_ETL_Dimensiones' },
  { paso: 'Hechos', proc: 'usp_ETL_Hechos' },
] as const;
const AUD_COLS = `id_run, paso, inicio, fin, leidas, insertadas, rechazadas, estado, mensaje, DATEDIFF(MILLISECOND, inicio, ISNULL(fin, SYSDATETIME())) AS ms`;

let etlRunning = false;
export async function runEtl() {
  if (etlRunning) throw httpErr(409, 'Ya hay un ETL en ejecución');
  etlRunning = true;
  const steps: any[] = [];
  try {
    for (const s of ETL_STEPS) {
      try {
        const r = await query(etlPool, `EXEC ${s.proc}; SELECT TOP 1 ${AUD_COLS} FROM AUDITORIA_ETL WHERE paso = '${s.paso}' ORDER BY id_run DESC`);
        steps.push(r.rows[0]);
      } catch (e: any) {
        const r = await query(etlPool, `SELECT TOP 1 ${AUD_COLS} FROM AUDITORIA_ETL WHERE paso = '${s.paso}' ORDER BY id_run DESC`);
        steps.push(r.rows[0] ?? { paso: s.paso, estado: 'ERROR', mensaje: e.message });
        break;
      }
    }
    return { steps, ok: steps.length === ETL_STEPS.length && steps.every((x) => x.estado === 'OK') };
  } finally {
    etlRunning = false;
  }
}
export async function etlRuns(limit = 50) {
  return (await query(martPool, `SELECT TOP (${Math.min(limit, 200)}) ${AUD_COLS} FROM AUDITORIA_ETL ORDER BY id_run DESC`)).rows;
}

/* ---------------- Calidad de datos ---------------- */
const DQ_RULES = [
  { id: 'DQ-01', rule: 'swls_5_respuestas', total: 'SELECT COUNT(*) FROM ENCUESTA_BIENESTAR',
    bad: `SELECT COUNT(*) FROM (SELECT eb.id_encuesta FROM ENCUESTA_BIENESTAR eb LEFT JOIN RESPUESTA_SWLS rs ON rs.id_encuesta = eb.id_encuesta GROUP BY eb.id_encuesta HAVING COUNT(rs.id_item) <> 5) q` },
  { id: 'DQ-02', rule: 'fecha_dentro_de_ola', total: 'SELECT COUNT(*) FROM ENCUESTA_BIENESTAR',
    bad: `SELECT COUNT(*) FROM ENCUESTA_BIENESTAR eb WHERE NOT EXISTS (SELECT 1 FROM OLA_MEDICION o WHERE eb.fecha_aplicacion BETWEEN o.fecha_inicio AND o.fecha_fin)` },
  { id: 'DQ-03', rule: 'valoracion_1_a_5', total: 'SELECT COUNT(*) FROM REGISTRO_INTERACCION',
    bad: 'SELECT COUNT(*) FROM REGISTRO_INTERACCION WHERE valoracion NOT BETWEEN 1 AND 5' },
  { id: 'DQ-04', rule: 'valor_swls_1_a_7', total: 'SELECT COUNT(*) FROM RESPUESTA_SWLS',
    bad: 'SELECT COUNT(*) FROM RESPUESTA_SWLS WHERE valor NOT BETWEEN 1 AND 7' },
  { id: 'DQ-05', rule: 'duracion_interaccion_valida', total: 'SELECT COUNT(*) FROM REGISTRO_INTERACCION',
    bad: 'SELECT COUNT(*) FROM REGISTRO_INTERACCION WHERE duracion_horas <= 0 OR duracion_horas > 24' },
  { id: 'DQ-06', rule: 'duracion_actividad_valida', total: 'SELECT COUNT(*) FROM REGISTRO_ACTIVIDAD',
    bad: 'SELECT COUNT(*) FROM REGISTRO_ACTIVIDAD WHERE duracion_min <= 0 OR duracion_min > 600' },
  { id: 'DQ-07', rule: 'actividad_minimo_10_min', total: 'SELECT COUNT(*) FROM REGISTRO_ACTIVIDAD',
    bad: 'SELECT COUNT(*) FROM REGISTRO_ACTIVIDAD WHERE duracion_min < 10' },
  { id: 'DQ-08', rule: 'interaccion_atipica_8h', total: 'SELECT COUNT(*) FROM REGISTRO_INTERACCION',
    bad: 'SELECT COUNT(*) FROM REGISTRO_INTERACCION WHERE duracion_horas > 8' },
  { id: 'DQ-09', rule: 'ingreso_informado', total: 'SELECT COUNT(*) FROM ESTUDIANTE',
    bad: `SELECT COUNT(*) FROM ESTUDIANTE e JOIN RANGO_INGRESO r ON r.id_rango = e.id_rango WHERE r.descripcion = 'No informa'` },
];
export async function dataQuality() {
  const out = [];
  for (const r of DQ_RULES) {
    const [t, b] = await Promise.all([query(oltpPool, r.total), query(oltpPool, r.bad)]);
    const total = Object.values(t.rows[0])[0] as number;
    const violations = Object.values(b.rows[0])[0] as number;
    out.push({ id: r.id, rule: r.rule, total, violations, pct: total ? violations / total : 0, sql: b.sql });
  }
  return out;
}

/* ---------------- Meta ---------------- */
export async function meta() {
  const [esc, olas, vin, mod, act, rango, cfg, ages] = await Promise.all([
    query(martPool, 'SELECT DISTINCT Facultad, Escuela FROM DimProgramaAcademico ORDER BY Facultad, Escuela'),
    query(oltpPool, 'SELECT o.numero, CONVERT(varchar(10), o.fecha_inicio, 23) AS inicio, CONVERT(varchar(10), o.fecha_fin, 23) AS fin, p.codigo AS periodo FROM OLA_MEDICION o JOIN PERIODO_ACADEMICO p ON p.id_periodo = o.id_periodo ORDER BY p.fecha_inicio, o.numero'),
    query(oltpPool, 'SELECT id_vinculo AS id, nombre FROM TIPO_VINCULO ORDER BY id_vinculo'),
    query(oltpPool, 'SELECT id_modalidad AS id, nombre FROM MODALIDAD ORDER BY id_modalidad'),
    query(oltpPool, 'SELECT a.id_actividad AS id, a.nombre, ta.nombre AS tipo, i.nombre AS intensidad FROM ACTIVIDAD a JOIN TIPO_ACTIVIDAD ta ON ta.id_tipo_act = a.id_tipo_act JOIN INTENSIDAD i ON i.id_intensidad = a.id_intensidad ORDER BY a.id_actividad'),
    query(martPool, 'SELECT DISTINCT RangoIngreso FROM DimEstudiante ORDER BY RangoIngreso'),
    getConfig(),
    query(martPool, 'SELECT DISTINCT RangoEdad FROM DimEstudiante ORDER BY RangoEdad'),
  ]);
  const escuelas: Record<string, string[]> = {};
  for (const r of esc.rows) (escuelas[r.Facultad] ??= []).push(r.Escuela);
  return {
    hoy: today(),
    facultades: Object.keys(escuelas),
    escuelas,
    rangosEdad: ages.rows.map((r) => r.RangoEdad),
    rangosIngreso: rango.rows.map((r) => r.RangoIngreso),
    olas: olas.rows,
    vinculos: vin.rows,
    modalidades: mod.rows,
    actividades: act.rows,
    kpis: Object.entries(cfg).map(([id, c]) => ({ id, ...c })),
    medidas: Object.entries(MEASURES).map(([id, m]) => ({ id, fact: m.fact, label: m.label })),
    dimensiones: Object.entries(DIMS).map(([id, d]) => ({ id, facts: d.facts, label: d.label })),
    jerarquias: HIERARCHIES,
    ia: config.ai.provider,
  };
}

/* ---------------- Mi bienestar ---------------- */
export async function me(codEst: number) {
  const ex = await query(oltpPool, `SELECT e.cod_estudiante, esc.nombre AS escuela FROM ESTUDIANTE e JOIN ESCUELA esc ON esc.id_escuela = e.id_escuela WHERE e.cod_estudiante = @c`, { c: codEst });
  if (!ex.rows[0]) throw httpErr(404, 'Estudiante no encontrado');
  const [surv, inter, act, dias, personal] = await Promise.all([
    query(oltpPool, `SELECT o.numero AS ola, CONVERT(varchar(10), eb.fecha_aplicacion, 23) AS fecha, SUM(rs.valor) AS puntaje, COUNT(*) AS items
                     FROM ENCUESTA_BIENESTAR eb JOIN OLA_MEDICION o ON o.id_ola = eb.id_ola JOIN RESPUESTA_SWLS rs ON rs.id_encuesta = eb.id_encuesta
                     WHERE eb.cod_estudiante = @c GROUP BY o.numero, eb.fecha_aplicacion ORDER BY o.numero`, { c: codEst }),
    query(oltpPool, `SELECT TOP 40 CONVERT(varchar(10), r.fecha, 23) AS fecha, ti.descripcion AS tipo, r.duracion_horas AS horas, r.valoracion
                     FROM REGISTRO_INTERACCION r JOIN TIPO_INTERACCION ti ON ti.id_tipo_inter = r.id_tipo_inter WHERE r.cod_estudiante = @c ORDER BY r.fecha DESC, r.id_registro DESC`, { c: codEst }),
    query(oltpPool, `SELECT TOP 40 CONVERT(varchar(10), r.fecha, 23) AS fecha, a.nombre AS actividad, ta.nombre AS tipo, r.duracion_min AS minutos
                     FROM REGISTRO_ACTIVIDAD r JOIN ACTIVIDAD a ON a.id_actividad = r.id_actividad JOIN TIPO_ACTIVIDAD ta ON ta.id_tipo_act = a.id_tipo_act
                     WHERE r.cod_estudiante = @c ORDER BY r.fecha DESC, r.id_registro DESC`, { c: codEst }),
    query(oltpPool, `SELECT DISTINCT CONVERT(varchar(10), fecha, 23) AS fecha FROM REGISTRO_ACTIVIDAD WHERE cod_estudiante = @c AND duracion_min >= 10 ORDER BY fecha DESC`, { c: codEst }),
    query(martPool, `WITH sem AS (SELECT COUNT(DISTINCT InicioSemana) AS n FROM v_calendario), e AS (SELECT KeyEstudiante FROM DimEstudiante WHERE cod_estudiante = @c)
      SELECT swls = (SELECT AVG(CAST(PuntajeSWLS AS FLOAT)) FROM Hecho_Bienestar h JOIN e ON e.KeyEstudiante = h.KeyEstudiante),
             horas = (SELECT SUM(HorasSignificativas) FROM Hecho_Interaccion h JOIN e ON e.KeyEstudiante = h.KeyEstudiante) / (SELECT n FROM sem),
             valoracion = (SELECT AVG(ValoracionInteraccion) FROM Hecho_Interaccion h JOIN e ON e.KeyEstudiante = h.KeyEstudiante),
             dias = (SELECT COUNT(DISTINCT h.KeyTiempo) FROM Hecho_Actividad h JOIN DimActividad da ON da.KeyActividad = h.KeyActividad AND da.TipoActividad = N'Actividad física' JOIN e ON e.KeyEstudiante = h.KeyEstudiante) * 1.0 / (SELECT n FROM sem)`, { c: codEst }),
  ]);
  // racha: dias consecutivos con actividad >= 10 min, terminando en el ultimo dia registrado
  const days = dias.rows.map((r) => r.fecha as string);
  let racha = 0;
  for (let i = 0; i < days.length; i++) {
    if (i === 0) { racha = 1; continue; }
    const diff = (Date.parse(days[i - 1]) - Date.parse(days[i])) / 86400000;
    if (diff === 1) racha++; else break;
  }
  const p = personal.rows[0] ?? {};
  return {
    cod_estudiante: codEst,
    escuela: ex.rows[0].escuela,
    encuestas: surv.rows,
    interacciones: inter.rows,
    actividades: act.rows,
    racha,
    ultimoDiaActividad: days[0] ?? null,
    personal: { swls: p.swls ?? null, horas: p.horas ?? null, valoracion: p.valoracion ?? null, dias: p.dias ?? null },
  };
}
