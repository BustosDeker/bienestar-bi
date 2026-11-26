import sql from 'mssql';
import { config } from '../config.js';

export type Params = Record<string, string | number | null>;

function mk(user: { user: string; password: string }, database: string, requestTimeout = 30000) {
  let pool: sql.ConnectionPool | null = null;
  return async () => {
    if (pool?.connected) return pool;
    pool = await new sql.ConnectionPool({
      server: config.db.host,
      port: config.db.port,
      user: user.user,
      password: user.password,
      database,
      requestTimeout,
      options: { encrypt: config.db.encrypt, trustServerCertificate: config.db.trustCert },
      pool: { max: 8, min: 0, idleTimeoutMillis: 30000 },
    }).connect();
    return pool;
  };
}

export const martPool = mk(config.db.api, config.db.martName);
export const oltpPool = mk(config.db.api, config.db.oltpName);
export const etlPool = mk(config.db.etl, config.db.martName, 120000);

export interface QueryResult<T = any> {
  rows: T[];
  ms: number;
  sql: string;
}

/** Ejecuta una consulta parametrizada. `sql` devuelto es la version con parametros sustituidos (para "Ver consulta SQL"). */
export async function query<T = any>(
  getPool: () => Promise<sql.ConnectionPool>,
  text: string,
  params: Params = {},
): Promise<QueryResult<T>> {
  const pool = await getPool();
  const req = pool.request();
  for (const [k, v] of Object.entries(params)) req.input(k, v);
  const t0 = performance.now();
  const r = await req.query(text);
  return { rows: (r.recordset ?? []) as T[], ms: Math.round(performance.now() - t0), sql: inlineParams(text, params) };
}

export function inlineParams(text: string, params: Params): string {
  let out = text;
  for (const k of Object.keys(params).sort((a, b) => b.length - a.length)) {
    const v = params[k];
    const lit = v === null ? 'NULL' : typeof v === 'number' ? String(v) : `N'${String(v).replace(/'/g, "''")}'`;
    out = out.replace(new RegExp(`@${k}\b`, 'g'), lit);
  }
  return out.replace(/\n\s+/g, '\n').trim();
}
