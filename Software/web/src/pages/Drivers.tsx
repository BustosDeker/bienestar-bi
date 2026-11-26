import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Chart, { axisStyle, chartColors } from '../components/Chart';
import { EmptyState, ErrorState, PageHeader, Skeleton, useTitle } from '../components/ui';
import { useDrivers } from '../lib/hooks';
import { useUI } from '../lib/store';
import { fmt, fmtSigned } from '../lib/util';

function Ranking({ rows, kind }: { rows: any[]; kind: 'vinculo' | 'actividad' }) {
  const { t } = useTranslation();
  const theme = useUI((s) => s.theme);
  const data = rows.filter((r) => r.difSWLS !== null);
  const opt = useMemo(() => {
    const c = chartColors();
    const d = [...data].reverse();
    return {
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      tooltip: { valueFormatter: (v: number) => fmtSigned(v, 2) },
      xAxis: { type: 'value', ...axisStyle(), axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'category', data: d.map((r) => r.grupo), ...axisStyle() },
      series: [{ type: 'bar', data: d.map((r) => r.difSWLS), barWidth: 16, itemStyle: { color: c.accent, borderRadius: [0, 6, 6, 0] }, label: { show: true, position: 'right', formatter: (p: any) => fmtSigned(p.value, 2), color: c.text } }],
    };
  }, [data, theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const unit = kind === 'vinculo' ? t('drivers.hoursWeek') : t('drivers.minWeek');
  return (
    <div className="card">
      <h2 className="text-section">{kind === 'vinculo' ? t('drivers.bonds') : t('drivers.activities')}</h2>
      <p className="mb-2 text-label text-muted">{t('drivers.rankHint')}</p>
      {data.length ? (
        <>
          <Chart option={opt} height={Math.max(180, data.length * 34)} label={kind === 'vinculo' ? t('drivers.bonds') : t('drivers.activities')} table={{ columns: [t('drivers.group'), t('drivers.diff')], rows: data.map((r) => [r.grupo, Number(fmt(r.difSWLS, 2).replace(',', '.'))]) }} />
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[420px] text-left tnum">
              <thead className="text-label text-muted"><tr><th className="py-1 pr-2">{t('drivers.group')}</th>{kind === 'vinculo' && <th className="px-2 text-right">{t('drivers.rating')}</th>}<th className="px-2 text-right">{unit}</th><th className="px-2 text-right">{t('drivers.swlsChange')}</th><th className="px-2 text-right">n</th></tr></thead>
              <tbody>{data.map((r) => (
                <tr key={r.grupo} className="border-t border-line">
                  <td className="py-1.5 pr-2">{r.grupo}</td>
                  {kind === 'vinculo' && <td className="px-2 text-right">{fmt(r.valoracion, 2)}</td>}
                  <td className="px-2 text-right">{fmt(r.cantidadSemanal, 1)}</td>
                  <td className="px-2 text-right">{fmtSigned(r.variacionSWLS, 2)}</td>
                  <td className="px-2 text-right">{r.n}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </>
      ) : <EmptyState title={t('common.noData')} hint={t('privacy.hint')} />}
    </div>
  );
}

export default function Drivers() {
  const { t } = useTranslation();
  useTitle(t('nav.drivers'));
  const q = useDrivers();
  const theme = useUI((s) => s.theme);
  const d = q.data;
  const vars: string[] = d?.vars ?? [];
  const lab = (v: string) => t(`drivers.short.${v}`, { defaultValue: v });

  const matrix = useMemo(() => {
    if (!d || d.suppressed) return null;
    const c = chartColors();
    const data: any[] = [];
    d.matrix.forEach((row: (number | null)[], y: number) => row.forEach((v, x) => { if (v !== null) data.push([x, y, Number(v.toFixed(2))]); }));
    return {
      grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
      tooltip: { formatter: (p: any) => `${lab(vars[p.value[1]])} × ${lab(vars[p.value[0]])}<br/>ρ = <b>${fmt(p.value[2], 2)}</b>` },
      xAxis: { type: 'category', data: vars.map(lab), axisLabel: { color: c.muted, interval: 0, rotate: 25 }, axisLine: { lineStyle: { color: c.border } }, axisTick: { show: false } },
      yAxis: { type: 'category', data: vars.map(lab), inverse: true, ...axisStyle() },
      visualMap: { min: -1, max: 1, orient: 'horizontal', left: 'center', bottom: 0, calculable: false, inRange: { color: ['#3B82F6', c.surface, '#EF4444'] }, textStyle: { color: c.muted } },
      series: [{ type: 'heatmap', data, label: { show: true, formatter: (p: any) => fmt(p.value[2], 2), color: '#111' }, itemStyle: { borderColor: c.surface, borderWidth: 2, borderRadius: 4 } }],
    };
  }, [d, theme, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const scatter = useMemo(() => {
    const c = chartColors();
    return {
      grid: { left: 8, right: 16, top: 16, bottom: 24, containLabel: true },
      tooltip: { formatter: (p: any) => `${t('drivers.hoursWeek')}: <b>${fmt(p.value[0], 1)}</b><br/>SWLS: <b>${fmt(p.value[1], 1)}</b>` },
      xAxis: { type: 'value', name: t('drivers.hoursWeek'), nameLocation: 'middle', nameGap: 26, ...axisStyle(), scale: true },
      yAxis: { type: 'value', name: 'SWLS', ...axisStyle(), scale: true },
      series: [{ type: 'scatter', symbolSize: 7, data: (d?.scatter ?? []).map((p: any) => [p.x, p.y]), itemStyle: { color: c.accent, opacity: 0.6 } }],
    };
  }, [d, theme, t]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <PageHeader title={t('drivers.title')} subtitle={t('drivers.subtitle')} />
      <div role="alert" className="flex items-start gap-2 rounded-card border border-warn/50 bg-warn/10 p-3 text-body">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn-t" aria-hidden />
        <p><b>{t('drivers.warnTitle')}</b> {t('drivers.warn')}</p>
      </div>
      {q.isLoading && <Skeleton className="h-72" />}
      {q.error && <div className="card"><ErrorState error={q.error} retry={() => q.refetch()} /></div>}
      {d && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Ranking rows={d.vinculos} kind="vinculo" />
            <Ranking rows={d.actividades} kind="actividad" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card">
              <h2 className="text-section">{t('drivers.matrix')}</h2>
              <p className="mb-2 text-label text-muted">{t('drivers.matrixHint', { n: d.n })}</p>
              {matrix ? <Chart option={matrix} height={340} label={t('drivers.matrix')} table={{ columns: ['', ...vars.map(lab)], rows: d.matrix.map((r: (number | null)[], i: number) => [lab(vars[i]), ...r.map((v) => (v === null ? null : Number(v.toFixed(2))))]) }} /> : <EmptyState title={t('privacy.suppressed')} hint={t('privacy.hint')} />}
            </section>
            <section className="card">
              <h2 className="text-section">{t('drivers.scatter')}</h2>
              <p className="mb-2 text-label text-muted">{t('drivers.scatterHint')}</p>
              {d.scatter.length ? <Chart option={scatter} height={340} label={t('drivers.scatter')} table={{ columns: [t('drivers.hoursWeek'), 'SWLS'], rows: d.scatter.slice(0, 60).map((p: any) => [Number(fmt(p.x, 2).replace(',', '.')), Number(fmt(p.y, 2).replace(',', '.'))]) }} /> : <EmptyState title={t('privacy.suppressed')} hint={t('privacy.hint')} />}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
