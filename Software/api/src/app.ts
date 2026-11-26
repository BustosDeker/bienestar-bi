import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { z, ZodError } from 'zod';
import { recommend } from './ai/index.js';
import { recommendSchema } from './ai/types.js';
import { config } from './config.js';
import { authenticate, signToken, verifyToken, type Rol, type Session } from './lib/auth.js';
import { drivers } from './lib/drivers.js';
import { explore, exploreSchema } from './lib/explore.js';
import { parseFilters } from './lib/filters.js';
import { computeKpi, KPI_IDS } from './lib/kpi.js';
import { activitySchema, dataQuality, etlRuns, interactionSchema, logActivity, logInteraction, logSurvey, me, meta, runEtl, surveySchema } from './lib/ops.js';
import { runReport } from './lib/reports.js';

export const COOKIE = 'session';
type Env = { Variables: { session: Session } };

const httpErr = (status: number, message: string) => Object.assign(new Error(message), { status });

/**
 * Permisos por rol. Estudiante: solo su propio módulo (Mi bienestar), agregados anónimos de KPI para comparar y el coach.
 * Bienestar: todo el panel de gestión, pero sin acceso a datos individuales ni a los registros de los estudiantes.
 */
const PUBLIC = new Set(['POST /api/auth/login', 'GET /api/health']);
const ANY_ROLE = new Set(['GET /api/auth/me', 'POST /api/auth/logout', 'GET /api/meta', 'POST /api/ai/recommend']);
const STUDENT_ONLY = new Set(['GET /api/me', 'POST /api/log/survey', 'POST /api/log/interaction', 'POST /api/log/activity']);
const STUDENT_ALSO = new Set(['GET /api/kpis']); // solo agregados (con k-anonimato) para el radar frente al grupo

export function allowed(rol: Rol, method: string, path: string): boolean {
  const key = `${method} ${path.replace(/\/$/, '')}`;
  if (ANY_ROLE.has(key)) return true;
  if (rol === 'estudiante') return STUDENT_ONLY.has(key) || STUDENT_ALSO.has(key);
  return !STUDENT_ONLY.has(key); // bienestar: todo lo demás
}

export function createApp() {
  const app = new Hono<Env>();

  app.use('*', secureHeaders());
  app.use('/api/*', cors({ origin: config.corsOrigins, credentials: true, allowHeaders: ['content-type'], allowMethods: ['GET', 'POST', 'OPTIONS'] }));

  // límite de tasa simple en memoria (por IP, ventana de 1 minuto); más estricto para el inicio de sesión
  const hits = new Map<string, { n: number; reset: number }>();
  const limit = (bucket: string, ip: string, max: number) => {
    const k = `${bucket}|${ip}`, now = Date.now(), h = hits.get(k);
    if (!h || h.reset < now) { hits.set(k, { n: 1, reset: now + 60_000 }); return true; }
    return ++h.n <= max;
  };
  const ipOf = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'local';

  app.use('/api/*', async (c, next) => {
    if (!limit('all', ipOf(c), config.rateLimitPerMin)) return c.json({ error: 'Demasiadas solicitudes' }, 429);
    await next();
  });

  // autenticación y autorización por rol
  app.use('/api/*', async (c, next) => {
    const key = `${c.req.method} ${new URL(c.req.url).pathname.replace(/\/$/, '')}`;
    if (c.req.method === 'OPTIONS' || PUBLIC.has(key)) return next();
    const session = verifyToken(getCookie(c, COOKIE));
    if (!session) return c.json({ error: 'Inicia sesión para continuar' }, 401);
    if (!allowed(session.rol, c.req.method, new URL(c.req.url).pathname)) return c.json({ error: 'No tienes permiso para esta acción' }, 403);
    c.set('session', session);
    await next();
  });

  app.onError((e: any, c) => {
    if (e instanceof ZodError) return c.json({ error: 'Parámetros inválidos', detalles: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, 400);
    if (e?.status && e.status < 500) return c.json({ error: e.message }, e.status);
    console.error('[api]', e?.message ?? e);   // nunca se registran datos personales
    return c.json({ error: 'Error interno', detalle: process.env.NODE_ENV === 'production' ? undefined : e?.message }, 500);
  });

  const q = (c: Context) => c.req.query() as Record<string, string | undefined>;
  const sess = (c: Context<Env>) => c.get('session');
  const myCod = (c: Context<Env>) => {
    const cod = sess(c).cod;
    if (!cod) throw httpErr(403, 'Esta cuenta no tiene un estudiante asociado');
    return cod;
  };

  app.get('/api/health', (c) => c.json({ ok: true }));

  /* ---- sesión ---- */
  const loginSchema = z.object({ username: z.string().min(1).max(50), password: z.string().min(1).max(200) });
  app.post('/api/auth/login', async (c) => {
    if (!limit('login', ipOf(c), config.loginLimitPerMin)) return c.json({ error: 'Demasiados intentos. Espera un minuto.' }, 429);
    const b = loginSchema.parse(await c.req.json());
    const s = await authenticate(b.username.trim(), b.password);
    if (!s) return c.json({ error: 'Usuario o contraseña incorrectos' }, 401);
    setCookie(c, COOKIE, signToken(s), { httpOnly: true, sameSite: 'Strict', secure: config.auth.cookieSecure, path: '/', maxAge: config.auth.ttlSec });
    return c.json({ username: s.sub, rol: s.rol, cod_estudiante: s.cod ?? null });
  });
  app.post('/api/auth/logout', (c) => { deleteCookie(c, COOKIE, { path: '/' }); return c.json({ ok: true }); });
  app.get('/api/auth/me', (c) => { const s = sess(c); return c.json({ username: s.sub, rol: s.rol, cod_estudiante: s.cod ?? null }); });

  app.get('/api/meta', async (c) => c.json(await meta()));

  app.get('/api/kpis', async (c) => {
    const f = parseFilters(q(c));
    const res = await Promise.all(KPI_IDS.map((id) => computeKpi(id, f)));
    const kpis = res.map(({ queries, ...k }) => (k.n < f.k ? { ...k, valor: null, estado: null, variacion: null, byOla: [], series: [], suppressed: true } : k));
    return c.json({ k: f.k, kpis });
  });

  app.get('/api/reports/:n', async (c) => {
    const n = Number(c.req.param('n'));
    const r = Number.isInteger(n) ? await runReport(n, parseFilters(q(c))) : null;
    return r ? c.json(r) : c.json({ error: 'Reporte inexistente (1 a 7)' }, 404);
  });

  app.post('/api/explore', async (c) => c.json(await explore(exploreSchema.parse(await c.req.json()))));
  app.get('/api/drivers', async (c) => c.json(await drivers(parseFilters(q(c)))));

  /* ---- Mi bienestar: solo el estudiante autenticado y solo sus propios datos ---- */
  const omitCod = { cod_estudiante: true } as const;
  app.post('/api/log/survey', async (c) => c.json(await logSurvey({ ...surveySchema.omit(omitCod).parse(await c.req.json()), cod_estudiante: myCod(c) }), 201));
  app.post('/api/log/interaction', async (c) => c.json(await logInteraction({ ...interactionSchema.omit(omitCod).parse(await c.req.json()), cod_estudiante: myCod(c) }), 201));
  app.post('/api/log/activity', async (c) => c.json(await logActivity({ ...activitySchema.omit(omitCod).parse(await c.req.json()), cod_estudiante: myCod(c) }), 201));
  app.get('/api/me', async (c) => c.json(await me(myCod(c))));

  app.post('/api/ai/recommend', async (c) => c.json(await recommend(recommendSchema.parse(await c.req.json()))));

  app.post('/api/etl/run', async (c) => c.json(await runEtl()));
  app.get('/api/etl/runs', async (c) => c.json(await etlRuns(Number(c.req.query('limit') ?? 50))));
  app.get('/api/dq', async (c) => c.json(await dataQuality()));

  app.notFound((c) => c.json({ error: 'No encontrado' }, 404));
  return app;
}
