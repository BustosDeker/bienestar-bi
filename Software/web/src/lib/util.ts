import { useUI } from './store';

export type Estado = 'bueno' | 'regular' | 'malo' | null | undefined;

export const fmt = (v: number | null | undefined, d = 1) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat(useUI.getState().lang === 'en' ? 'en-US' : 'es-PE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
};
export const fmtSigned = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '—' : (v > 0 ? '+' : '') + fmt(v, d));

export function estadoDe(v: number | null | undefined, u?: { umbral_bueno: number; umbral_regular: number }): Estado {
  if (v === null || v === undefined || !u) return null;
  return v >= u.umbral_bueno ? 'bueno' : v >= u.umbral_regular ? 'regular' : 'malo';
}

export const ESTADO_CLASS: Record<'bueno' | 'regular' | 'malo', { text: string; bg: string; dot: string }> = {
  bueno: { text: 'text-good-t', bg: 'bg-good/10', dot: 'bg-good' },
  regular: { text: 'text-warn-t', bg: 'bg-warn/10', dot: 'bg-warn' },
  malo: { text: 'text-bad-t', bg: 'bg-bad/10', dot: 'bg-bad' },
};

export function downloadFile(name: string, content: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function toCSV(rows: Record<string, unknown>[], cols?: string[]) {
  const c = cols ?? (rows[0] ? Object.keys(rows[0]) : []);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [c.join(','), ...rows.map((r) => c.map((k) => esc(r[k])).join(','))].join('\n');
}

export const KPI_ICON: Record<string, string> = { 'KPI-01': 'smile', 'KPI-02': 'users', 'KPI-03': 'heart-handshake', 'KPI-04': 'footprints' };
export const SERIES = ['#0F9D8A', '#3B82F6', '#F59E0B', '#A855F7', '#EF4444', '#64748B', '#14B8A6', '#EC4899'];
export const SEX_LABEL = (s: string, t: (k: string) => string) => (s === 'F' ? t('common.female') : s === 'M' ? t('common.male') : s);
