import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table2 } from 'lucide-react';
import type { ECharts } from 'echarts/core';
import { useUI } from '../lib/store';

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export function chartColors() {
  return { text: css('--text'), muted: css('--muted'), border: css('--border'), surface: css('--surface'), accent: css('--accent'), good: css('--good'), warn: css('--warn'), bad: css('--bad') };
}
export const palette = ['#0F9D8A', '#3B82F6', '#F59E0B', '#A855F7', '#EF4444', '#64748B', '#14B8A6', '#EC4899'];

/** Estilos base: sin bordes ni fondos, cuadricula casi invisible, un solo eje. */
export function baseOption() {
  const c = chartColors();
  return {
    color: palette,
    backgroundColor: 'transparent',
    textStyle: { color: c.muted, fontFamily: 'Inter Variable, Inter, system-ui, sans-serif', fontSize: 12 },
    animation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    tooltip: { backgroundColor: c.surface, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'box-shadow:0 4px 16px rgba(0,0,0,.08);border-radius:8px' },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
  };
}
export const axisStyle = () => {
  const c = chartColors();
  return {
    axisLine: { lineStyle: { color: c.border } },
    axisTick: { show: false },
    axisLabel: { color: c.muted },
    splitLine: { lineStyle: { color: c.border, opacity: 0.45 } },
  };
};

export interface AltTable {
  columns: string[];
  rows: (string | number | null)[][];
}

interface Props {
  option: Record<string, unknown>;
  height?: number;
  label: string;
  table?: AltTable;
  onClick?: (p: any) => void;
  className?: string;
}

/** Envoltorio de ECharts con tabla alternativa accesible. */
export default function Chart({ option, height = 280, label, table, onClick, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<ECharts | null>(null);
  const [ready, setReady] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const { t } = useTranslation();
  const theme = useUI((s) => s.theme);
  const accent = useUI((s) => s.accent);
  const full = useMemo(() => ({ ...baseOption(), ...option }), [option, theme, accent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let ro: ResizeObserver | undefined;
    let dead = false;
    import('../lib/echartsCore').then(({ echarts }) => {
      if (dead || !el.current) return;
      inst.current = echarts.init(el.current, undefined, { renderer: 'canvas' });
      ro = new ResizeObserver(() => inst.current?.resize());
      ro.observe(el.current);
      setReady(true);
    });
    return () => { dead = true; ro?.disconnect(); inst.current?.dispose(); inst.current = null; };
  }, []);
  useEffect(() => { inst.current?.setOption(full as any, true); }, [full, ready]);
  useEffect(() => {
    const c = inst.current;
    if (!c) return;
    c.off('click');
    if (onClick) c.on('click', onClick);
  }, [onClick, ready]);

  return (
    <div className={className}>
      <div ref={el} style={{ height }} role="img" aria-label={label} />
      {table && (
        <>
          <button className="btn-ghost no-print mt-1 inline-flex items-center gap-1 rounded-ctl px-2 py-1 text-label text-muted hover:text-fg" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
            <Table2 size={14} strokeWidth={1.5} aria-hidden /> {showTable ? t('chart.hideTable') : t('chart.showTable')}
          </button>
          <div className={showTable ? 'mt-2 max-h-64 overflow-auto' : 'sr-only'}>
            <table className="w-full text-left text-label tnum">
              <caption className="sr-only">{label}</caption>
              <thead><tr>{table.columns.map((c) => <th key={c} scope="col" className="border-b border-line px-2 py-1 font-medium">{c}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="border-b border-line/50 px-2 py-1">{v ?? '—'}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
