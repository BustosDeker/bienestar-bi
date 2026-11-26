import { create } from 'zustand';

export type Rol = 'estudiante' | 'bienestar';
export interface User {
  username: string;
  rol: Rol;
  cod_estudiante: number | null;
  /** Sesión de demostración sin API (solo datos de ejemplo guardados). */
  demo?: boolean;
}

interface AuthState {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
}
export const useAuth = create<AuthState>((set) => ({ user: null, ready: false, setUser: (user) => set({ user, ready: true }) }));

/** Páginas permitidas por rol (la API también lo impone). */
export const ACCESS: Record<Rol, string[]> = {
  bienestar: ['/', '/reportes', '/explorador', '/drivers', '/coach', '/etl', '/ajustes'],
  estudiante: ['/mi-bienestar', '/ajustes'],
};
export const homeOf = (r: Rol) => (r === 'estudiante' ? '/mi-bienestar' : '/');
export const canOpen = (r: Rol, path: string) => ACCESS[r].some((p) => (p === '/' ? path === '/' : path === p || path.startsWith(p + '/')));

async function call(path: string, init?: RequestInit) {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...init });
  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { res, body };
}

/** Consulta la sesión al iniciar. Si no hay conexión con la API, entra en modo demostración (datos guardados). */
export async function loadSession() {
  try {
    const { res, body } = await call('/api/auth/me');
    if (res.ok) return useAuth.getState().setUser(body as User);
    if (res.status >= 500) throw new Error('server');
    useAuth.getState().setUser(null);
  } catch {
    useAuth.getState().setUser({ username: 'demo', rol: 'bienestar', cod_estudiante: null, demo: true });
  }
}

export async function login(username: string, password: string): Promise<string | null> {
  try {
    const { res, body } = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (!res.ok) return (body?.error as string) ?? 'No se pudo iniciar sesión';
    useAuth.getState().setUser(body as User);
    return null;
  } catch {
    return 'offline';
  }
}

export async function logout() {
  try { await call('/api/auth/logout', { method: 'POST', body: '{}' }); } catch { /* sin conexión */ }
  useAuth.getState().setUser(null);
}
