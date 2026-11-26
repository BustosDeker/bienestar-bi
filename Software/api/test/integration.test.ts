import sql from 'mssql';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';

const app = createApp();
const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0];
const send = (method: string, path: string, cookie = '', body?: unknown) =>
  app.request(path, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
const login = async (username: string, password: string) => {
  const r = await send('POST', '/api/auth/login', '', { username, password });
  return { status: r.status, cookie: cookieOf(r), body: (await r.json()) as any, headers: r.headers };
};
const BIENESTAR = ['bienestar', 'Bienestar2026!'] as const;
const STUDENT = ['202600001', 'Estudiante2026!'] as const;

let up = false;
let direct: sql.ConnectionPool;
let adm = '';
let stu = '';
beforeAll(async () => {
  try {
    direct = await new sql.ConnectionPool({
      server: config.db.host, port: config.db.port, user: 'sa', password: process.env.DB_SA_PASSWORD ?? 'Bienestar#2026',
      database: config.db.martName, options: { encrypt: false, trustServerCertificate: true },
    }).connect();
    adm = (await login(...BIENESTAR)).cookie;
    stu = (await login(...STUDENT)).cookie;
    up = !!adm && !!stu;
  } catch {
    up = false;
  }
});
const itDb = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!up) return ctx.skip();
    await fn();
  });

describe('autenticación y roles (API + BD)', () => {
  itDb('sin sesión: 401; la contraseña incorrecta no inicia sesión', async () => {
    expect((await send('GET', '/api/kpis')).status).toBe(401);
    expect((await login('bienestar', 'mal')).status).toBe(401);
    expect((await login('no-existe', 'x')).status).toBe(401);
  });
  itDb('la cookie de sesión es httpOnly y SameSite=Strict', async () => {
    const l = await login(...BIENESTAR);
    const sc = l.headers.get('set-cookie') ?? '';
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Strict/i);
    expect(l.body).toMatchObject({ rol: 'bienestar', cod_estudiante: null });
  });
  itDb('/api/auth/me devuelve la sesión y el estudiante queda atado a su código', async () => {
    const m = (await (await send('GET', '/api/auth/me', stu)).json()) as any;
    expect(m).toMatchObject({ rol: 'estudiante', cod_estudiante: 202600001 });
  });
  itDb('el estudiante no puede ver reportes, explorar, drivers, ETL ni calidad', async () => {
    for (const [m, p] of [['GET', '/api/reports/1'], ['POST', '/api/explore'], ['GET', '/api/drivers'], ['POST', '/api/etl/run'], ['GET', '/api/etl/runs'], ['GET', '/api/dq']])
      expect((await send(m, p, stu, m === 'POST' ? {} : undefined)).status, `${m} ${p}`).toBe(403);
  });
  itDb('bienestar no puede ver datos individuales ni escribir registros', async () => {
    expect((await send('GET', '/api/me', adm)).status).toBe(403);
    expect((await send('POST', '/api/log/survey', adm, { respuestas: [4, 4, 4, 4, 4] })).status).toBe(403);
  });
  itDb('/api/me solo devuelve los datos del propio estudiante', async () => {
    const me = (await (await send('GET', '/api/me', stu)).json()) as any;
    expect(me.cod_estudiante).toBe(202600001);
  });
  itDb('cerrar sesión borra la cookie', async () => {
    const r = await send('POST', '/api/auth/logout', adm);
    expect(r.headers.get('set-cookie') ?? '').toMatch(/session=;|Max-Age=0/i);
  });
});

describe('integración API + BD', () => {
  itDb('cada KPI de la API coincide con la consulta SQL directa', async () => {
    const d = (await (await send('GET', '/api/kpis', adm)).json()) as any;
    const q = async (t: string) => (await direct.request().query(t)).recordset[0].v as number;
    const k = Object.fromEntries(d.kpis.map((x: any) => [x.id, x.valor]));
    expect(k['KPI-01']).toBeCloseTo(await q('SELECT AVG(CAST(PuntajeSWLS AS FLOAT)) v FROM Hecho_Bienestar'), 6);
    expect(k['KPI-03']).toBeCloseTo(await q('SELECT AVG(ValoracionInteraccion) v FROM Hecho_Interaccion'), 6);
    expect(k['KPI-02']).toBeCloseTo(
      await q(`SELECT AVG(CAST(ISNULL(x.h,0) AS FLOAT)) v FROM v_calendario c LEFT JOIN
      (SELECT h.KeyEstudiante, t.InicioSemana, SUM(h.HorasSignificativas) h FROM Hecho_Interaccion h JOIN DimTiempo t ON t.KeyTiempo=h.KeyTiempo GROUP BY h.KeyEstudiante, t.InicioSemana) x
      ON x.KeyEstudiante=c.KeyEstudiante AND x.InicioSemana=c.InicioSemana`),
      6,
    );
    expect(k['KPI-04']).toBeCloseTo(
      await q(`SELECT AVG(CAST(ISNULL(x.d,0) AS FLOAT)) v FROM v_calendario c LEFT JOIN
      (SELECT h.KeyEstudiante, t.InicioSemana, COUNT(DISTINCT h.KeyTiempo) d FROM Hecho_Actividad h JOIN DimTiempo t ON t.KeyTiempo=h.KeyTiempo
       JOIN DimActividad a ON a.KeyActividad=h.KeyActividad WHERE a.TipoActividad=N'Actividad física' GROUP BY h.KeyEstudiante, t.InicioSemana) x
      ON x.KeyEstudiante=c.KeyEstudiante AND x.InicioSemana=c.InicioSemana`),
      6,
    );
  });
  itDb('los 7 reportes responden y respetan el diseño', async () => {
    for (let n = 1; n <= 7; n++) {
      const r = (await (await send('GET', `/api/reports/${n}`, adm)).json()) as any;
      expect(r.rows.length, `R${n}`).toBeGreaterThan(0);
      expect(r.validated, `R${n}`).toBe(true);
    }
  });
  itDb('k-anonimato oculta valores con k alto', async () => {
    const r = (await (await send('GET', '/api/reports/7?k=50', adm)).json()) as any;
    expect(r.rows.some((x: any) => x.suppressed && x.valor === null)).toBe(true);
  });
  itDb('variación SWLS con LAG: nula en la primera ola', async () => {
    const r = (
      await direct.request().query(`WITH p AS (SELECT h.KeyEstudiante, dt.OlaMedicion, h.PuntajeSWLS FROM Hecho_Bienestar h JOIN DimTiempo dt ON dt.KeyTiempo=h.KeyTiempo)
      SELECT TOP 1 PuntajeSWLS - LAG(PuntajeSWLS) OVER (PARTITION BY KeyEstudiante ORDER BY OlaMedicion) v FROM p WHERE KeyEstudiante = 1 ORDER BY OlaMedicion`)
    ).recordset[0];
    expect(r.v).toBeNull();
  });
  itDb('registrar encuesta: valida rango y ola', async () => {
    expect((await send('POST', '/api/log/survey', stu, { fecha: '2026-12-02', respuestas: [1, 2, 3, 4, 8] })).status).toBe(400);
    expect((await send('POST', '/api/log/survey', stu, { fecha: '2026-11-26', respuestas: [4, 4, 4, 4, 4] })).status).toBe(422);
  });
  itDb('ETL idempotente: dos corridas dejan los mismos conteos', async () => {
    const cnt = async () =>
      (await direct.request().query('SELECT (SELECT COUNT(*) FROM Hecho_Bienestar) a, (SELECT COUNT(*) FROM Hecho_Interaccion) b, (SELECT COUNT(*) FROM Hecho_Actividad) c, (SELECT COUNT(*) FROM DimEstudiante) d')).recordset[0];
    await send('POST', '/api/etl/run', adm, {});
    const a = await cnt();
    const r = (await (await send('POST', '/api/etl/run', adm, {})).json()) as any;
    const b = await cnt();
    expect(r.ok).toBe(true);
    expect(b).toEqual(a);
  });
});
