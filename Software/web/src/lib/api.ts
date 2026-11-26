import { useAuth } from './auth';
import { useUI, type Filters } from './store';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface KpiData {
  id: 'KPI-01' | 'KPI-02' | 'KPI-03' | 'KPI-04';
  nombre: string;
  valor: number | null;
  n: number;
  estado: 'bueno' | 'regular' | 'malo' | null;
  umbral: { umbral_bueno: number; umbral_regular: number };
  variacion: number | null;
  byOla: { grupo: string; valor: number; n: number }[];
  series: { grupo: string; valor: number }[];
  suppressed?: boolean;
}
export interface Meta {
  hoy: string;
  facultades: string[];
  escuelas: Record<string, string[]>;
  rangosEdad: string[];
  rangosIngreso: string[];
  olas: { numero: number; inicio: string; fin: string; periodo: string }[];
  vinculos: { id: number; nombre: string }[];
  modalidades: { id: number; nombre: string }[];
  actividades: { id: number; nombre: string; tipo: string; intensidad: string }[];
  kpis: { id: string; nombre: string; umbral_bueno: number; umbral_regular: number }[];
  medidas: { id: string; fact: string; label: string }[];
  dimensiones: { id: string; facts: string[]; label: string }[];
  jerarquias: { name: string; levels: string[] }[];
  ia: string;
}

export function filterQS(f: Filters, k: number) {
  const p = new URLSearchParams();
  for (const [key, v] of Object.entries(f)) if (v !== undefined && v !== '') p.set(key, String(v));
  p.set('k', String(k));
  return p.toString();
}

/** Rutas con archivo de demostración (JSON estático) para cuando la API no responde. */
function demoFile(path: string): string | null {
  const u = path.split('?')[0];
  if (u === '/api/meta') return 'meta';
  if (u === '/api/kpis') return 'kpis';
  if (u === '/api/drivers') return 'drivers';
  if (u === '/api/etl/runs') return 'etl-runs';
  if (u === '/api/dq') return 'dq';
  const r = u.match(/^\/api\/reports\/(\d)$/);
  if (r) return `reports-${r[1]}`;
  return null;
}

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    return demo<T>(path, init, new ApiError(0, 'offline'));
  }
  if (res.status >= 500 && (!init?.method || init.method === 'GET')) {
    const d = demoFile(path);
    if (d) return demo<T>(path, init, new ApiError(res.status, 'server'));
  }
  const ct = res.headers.get('content-type') ?? '';
  const body = ct.includes('json') ? await res.json() : null;
  if (res.status === 401 && !path.startsWith('/api/auth/')) useAuth.getState().setUser(null);
  if (!res.ok) throw new ApiError(res.status, body?.error ?? res.statusText);
  if (useUI.getState().demo && (!init?.method || init.method === 'GET')) useUI.getState().set({ demo: false });
  return body as T;
}

async function demo<T>(path: string, init: RequestInit | undefined, err: ApiError): Promise<T> {
  const f = (!init?.method || init.method === 'GET') ? demoFile(path) : null;
  if (!f) throw err;
  try {
    const r = await fetch(`/demo/${f}.json`);
    if (!r.ok) throw err;
    useUI.getState().set({ demo: true });
    return (await r.json()) as T;
  } catch {
    throw err;
  }
}
