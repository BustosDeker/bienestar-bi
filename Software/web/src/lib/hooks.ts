import { useQuery } from '@tanstack/react-query';
import { api, filterQS, type KpiData, type Meta } from './api';
import { useUI } from './store';

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api<Meta>('/api/meta'), staleTime: 5 * 60_000 });
}
export function useQS() {
  const f = useUI((s) => s.filters);
  const k = useUI((s) => s.k);
  return filterQS(f, k);
}
export function useKpis() {
  const qs = useQS();
  return useQuery({ queryKey: ['kpis', qs], queryFn: () => api<{ k: number; kpis: KpiData[] }>(`/api/kpis?${qs}`) });
}
export function useReport(n: number) {
  const qs = useQS();
  return useQuery({ queryKey: ['report', n, qs], queryFn: () => api<any>(`/api/reports/${n}?${qs}`) });
}
export function useExplore(body: any, enabled = true) {
  const f = useUI((s) => s.filters);
  const k = useUI((s) => s.k);
  const payload = { ...body, filters: { ...f, k } };
  return useQuery({
    queryKey: ['explore', payload],
    queryFn: () => api<any>('/api/explore', { method: 'POST', body: JSON.stringify(payload) }),
    enabled,
    placeholderData: (p) => p,
  });
}
export function useDrivers() {
  const qs = useQS();
  return useQuery({ queryKey: ['drivers', qs], queryFn: () => api<any>(`/api/drivers?${qs}`) });
}

/** Ola vigente o proxima segun la fecha del servidor. */
export function currentOla(meta?: Meta) {
  if (!meta) return null;
  const hoy = meta.hoy;
  const act = meta.olas.find((o) => hoy >= o.inicio && hoy <= o.fin);
  if (act) return { ola: act, estado: 'abierta' as const };
  const next = meta.olas.find((o) => o.inicio > hoy);
  if (next) return { ola: next, estado: 'proxima' as const };
  return { ola: meta.olas[meta.olas.length - 1], estado: 'cerrada' as const };
}
