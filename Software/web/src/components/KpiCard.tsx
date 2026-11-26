import { animate, motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Footprints, HeartHandshake, Minus, Smile, Users } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { KpiData } from '../lib/api';
import { fmt, fmtSigned } from '../lib/util';
import Chart from './Chart';
import { EstadoBadge } from './ui';

const ICONS = { 'KPI-01': Smile, 'KPI-02': Users, 'KPI-03': HeartHandshake, 'KPI-04': Footprints };
const DECIMALS = { 'KPI-01': 1, 'KPI-02': 1, 'KPI-03': 2, 'KPI-04': 2 } as const;

export function AnimatedNumber({ value, decimals, className }: { value: number | null; decimals: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const prev = useRef(0);
  useEffect(() => {
    if (value === null || !ref.current) return;
    if (reduce) { ref.current.textContent = fmt(value, decimals); return; }
    const c = animate(prev.current, value, { duration: 0.6, ease: 'easeOut', onUpdate: (v) => { if (ref.current) ref.current.textContent = fmt(v, decimals); } });
    prev.current = value;
    return () => c.stop();
  }, [value, decimals, reduce]);
  return <span ref={ref} className={className}>{value === null ? '—' : fmt(value, decimals)}</span>;
}

export default function KpiCard({ kpi, index }: { kpi: KpiData; index: number }) {
  const { t } = useTranslation();
  const Icon = ICONS[kpi.id];
  const dec = DECIMALS[kpi.id];
  const reduce = useReducedMotion();
  const v = kpi.variacion;
  const VarIcon = v === null ? Minus : v >= 0 ? ArrowUpRight : ArrowDownRight;
  const unit = kpi.id === 'KPI-01' ? t('kpi.unit1') : kpi.id === 'KPI-02' ? t('kpi.unit2') : kpi.id === 'KPI-03' ? t('kpi.unit3') : t('kpi.unit4');
  const color = kpi.estado === 'bueno' ? 'var(--good)' : kpi.estado === 'malo' ? 'var(--bad)' : 'var(--warn)';
  const spark = {
    grid: { left: 0, right: 0, top: 4, bottom: 4 },
    xAxis: { type: 'category', show: false, data: kpi.series.map((s) => s.grupo) },
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: { trigger: 'axis', confine: true, valueFormatter: (x: number) => fmt(x, dec) },
    series: [{ type: 'line', data: kpi.series.map((s) => s.valor), smooth: true, symbol: 'none', lineStyle: { width: 2, color }, areaStyle: { color, opacity: 0.08 } }],
  };
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.25 }}
      className="card flex flex-col gap-2" aria-labelledby={`k-${kpi.id}`}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted"><Icon size={18} strokeWidth={1.5} aria-hidden /><h3 id={`k-${kpi.id}`} className="text-label font-medium">{kpi.id} · {t(`kpi.${kpi.id}`)}</h3></div>
        <EstadoBadge estado={kpi.estado} />
      </header>
      {kpi.suppressed ? (
        <p className="py-6 text-body text-muted">{t('privacy.suppressed')}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={kpi.valor} decimals={dec} className="kpi-value text-kpi tnum" />
            <span className="text-label text-muted">{unit}</span>
          </div>
          <div className="flex items-center gap-1 text-label text-muted tnum">
            <VarIcon size={14} aria-hidden /> <span>{fmtSigned(v, dec)} {t('kpi.vsPrev')}</span>
            <span className="ml-auto">{t('kpi.target')} ≥ {kpi.umbral.umbral_bueno}</span>
          </div>
          <Chart option={spark} height={44} label={t('kpi.sparkLabel', { id: kpi.id })} table={{ columns: [t('kpi.group'), t('kpi.value')], rows: kpi.series.map((s) => [s.grupo, Number(fmt(s.valor, dec).replace(',', '.'))]) }} />
        </>
      )}
    </motion.article>
  );
}
