import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { oltpPool, query } from './db.js';

export type Rol = 'estudiante' | 'bienestar';
export interface Session {
  sub: string;           // username
  rol: Rol;
  cod?: number;          // solo estudiantes
  exp: number;           // epoch en segundos
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** JWT HS256 mínimo (sin dependencias). */
export function signToken(s: Omit<Session, 'exp'>, ttlSec = config.auth.ttlSec): string {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig = createHmac('sha256', config.auth.secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyToken(token: string | undefined): Session | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', config.auth.secret).update(`${parts[0]}.${parts[1]}`).digest();
  let given: Buffer;
  try { given = Buffer.from(parts[2], 'base64url'); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const s = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Session;
    if (!s.exp || s.exp < Math.floor(Date.now() / 1000)) return null;
    if (s.rol !== 'estudiante' && s.rol !== 'bienestar') return null;
    return s;
  } catch { return null; }
}

const scryptAsync = (pw: string, salt: Buffer, n: number, r: number, p: number) =>
  new Promise<Buffer>((res, rej) => scrypt(pw, salt, 32, { N: n, r, p, maxmem: 128 * n * r * 2 }, (e, k) => (e ? rej(e) : res(k))));

/** Formato: scrypt$N$r$p$salt(b64)$hash(b64). */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scryptAsync(pw, salt, 16384, 8, 1);
  return `scrypt$16384$8$1$${salt.toString('base64')}$${h.toString('base64')}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const got = await scryptAsync(pw, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p));
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe.
const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export async function authenticate(username: string, password: string): Promise<Omit<Session, 'exp'> | null> {
  const r = await query(oltpPool, 'SELECT username, password_hash, rol, cod_estudiante FROM USUARIO WHERE username = @u AND activo = 1', { u: username });
  const row = r.rows[0];
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY);
  if (!row || !ok) return null;
  return { sub: row.username, rol: row.rol, cod: row.cod_estudiante ?? undefined };
}
