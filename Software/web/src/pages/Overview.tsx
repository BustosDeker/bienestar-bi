import { Lightbulb } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Chart, { axisStyle, chartColors } from '../components/Chart';
import KpiCard from '../components/KpiCard';
import Recs from '../components/Recs';
import { EmptyState, ErrorState, PageHeader, Skeleton, useTitle } from '../components/ui';
import { currentOla, useExplore, useKpis, useMeta } from '../lib/hooks';
import { useUI } from '../lib/store';
import { estadoDe, fmt, fmtSigned } from '../lib/util';

export default function Overview() {
  const { t } = useTranslation();
  useTitle(t('nav.overview'));
  const { data: meta } = useMeta();
  const kp = useKpis();
  const k1 = kp.data?.kpis.find((k) => k.id === 'KPI-01');
  const u1 = k1?.umbral;
  const heat = useExplore({ measure: 'PuntajeSWLS', rows: ['Escuela'], cols: ['OlaMedicion'] });
  const bars = useExplore({ measure: 'HorasSignificativas', rows: ['TipoVinculo'], cols: [] });
  const vigente = currentOla(meta);
  const theme = useUI((s) => s.theme);
  const [recsOpen, setRecsOpen] = useState(false);

  const findings = useMemo(() => {
    const out: { tone: 'good' | 'warn' | 'bad' | 'info'; text: string }[] = [];
    const kpis = kp.data?.kpis ?? [];
    for (const k of kpis) {
      if (k.estado === 'malo') out.push({ tone: 'bad', text: t('findings.kpiBad', { id: k.id, name: t(`kpi.${k.id}`) }) });
    }
    const rows = (heat.data?.rows ?? []).filter((r: any) => r.valor !== null);
    const byEsc = new Map<string, number[]>();
    for (const r of rows) { const a = byEsc.get(r.Escuela) ?? []; a[Number(r.OlaMedicion) - 1] = r.valor; byEsc.set(r.Escuela, a); }
    const avg = [...byEsc.entries()].map(([e, a]) => { const v = a.filter((x) => x !== undefined); return { e, v: v.reduce((x, y) => x + y, 0) / v.length, first: v[0], last: v[v.length - 1] }; });
    if (avg.length && u1) {
      const lo = avg.reduce((a, b) => (a.v < b.v ? a : b));
      const hi = avg.reduce((a, b) => (a.v > b.v ? a : b));
      const st = (x: number) => t(`estado.${estadoDe(x, u1)}`).toLowerCase();
      out.push({ tone: estadoDe(lo.v, u1) === 'malo' ? 'bad' : 'warn', text: t('findings.lowSchool', { school: lo.e, value: fmt(lo.v), state: st(lo.v) }) });
      out.push({ tone: estadoDe(hi.v, u1) === 'bueno' ? 'good' : 'info', text: t('findings.highSchool', { school: hi.e, value: fmt(hi.v), state: st(hi.v) }) });
      const g = avg.filter((a) => a.first !== undefined && a.last !== undefined && a.first !== a.last).reduce<typeof avg[0] | null>((b, a) => (!b || Math.abs(a.last - a.first) > Math.abs(b.last - b.first) ? a : b), null);
      if (g) out.push({ tone: g.last >= g.first ? 'good' : 'warn', text: t('findings.trend', { school: g.e, delta: fmtSigned(g.last - g.first, 1) }) });
    }
    return out.slice(0, 5);
  }, [kp.data, heat.data, u1, t]);

  const evo = useMemo(() => {
    const c = chartColors();
    const s = k1?.byOla ?? [];
    return {
      grid: { left: 8, right: 56, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v, 2) },
      xAxis: { type: 'category', data: s.map((x) => `${t('common.wave')} ${x.grupo}`), ...axisStyle() },
      yAxis: { type: 'value', min: 15, max: 30, ...axisStyle() },
      series: [{
        type: 'line', data: s.map((x) => x.valor), smooth: true, symbolSize: 8, lineWidth: 3, label: { show: true, formatter: (p: any) => fmt(p.value, 1), color: c.text, position: 'top' },
        lineStyle: { width: 3, color: c.accent }, itemStyle: { color: c.accent },
        markLine: u1 ? { silent: true, symbol: 'none', label: { color: c.muted, formatter: (p: any) => p.name }, lineStyle: { type: 'dashed', color: c.muted, opacity: 0.6 },
          data: [{ yAxis: u1.umbral_bueno, name: t('estado.bueno') + ' ≥' + u1.umbral_bueno }, { yAxis: u1.umbral_regular, name: t('estado.regular') + ' ≥' + u1.umbral_regular }] } : undefined,
      }],
    };
  }, [k1, u1, t, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const heatOpt = useMemo(() => {
    const rows = heat.data?.rows ?? [];
    const esc = [...new Set<string>(rows.map((r: any) => r.Escuela))];
    const olas = [...new Set<string>(rows.map((r: any) => r.OlaMedicion))].sort();
    const c = chartColors();
    return {
      grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
      tooltip: { formatter: (p: any) => p.value[2] === null ? t('privacy.suppressed') : `${esc[p.value[1]]} · ${t('common.wave')} ${olas[p.value[0]]}<br/><b>${fmt(p.value[2], 2)}</b> · ${t(`estado.${estadoDe(p.value[2], u1)}`)}` },
      xAxis: { type: 'category', data: olas.map((o) => `${t('common.wave')} ${o}`), splitArea: { show: false }, ...axisStyle() },
      yAxis: { type: 'category', data: esc, inverse: true, ...axisStyle() },
      visualMap: { type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 14, itemHeight: 10, textStyle: { color: c.muted },
        pieces: [{ lt: u1?.umbral_regular ?? 20, label: t('estado.malo'), color: c.bad }, { gte: u1?.umbral_regular ?? 20, lt: u1?.umbral_bueno ?? 26, label: t('estado.regular'), color: c.warn }, { gte: u1?.umbral_bueno ?? 26, label: t('estado.bueno'), color: c.good }] },
      series: [{ type: 'heatmap', data: rows.filter((r: any) => r.valor !== null).map((r: any) => [olas.indexOf(r.OlaMedicion), esc.indexOf(r.Escuela), Number(r.valor.toFixed(2))]),
        label: { show: true, formatter: (p: any) => fmt(p.value[2], 1), color: '#111' }, itemStyle: { borderColor: c.surface, borderWidth: 3, borderRadius: 6 } }],
    };
  }, [heat.data, u1, t, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const barRows = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of bars.data?.rows ?? []) if (r.valor !== null) m.set(r.TipoVinculo, r.valor);
    return [...m.entries()].sort((a, b) => a[1] - b[1]);
  }, [bars.data]);
  const barOpt = useMemo(() => {
    const c = chartColors();
    return {
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      tooltip: { valueFormatter: (v: number) => `${fmt(v, 2)} h` },
      xAxis: { type: 'value', ...axisStyle(), axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'category', data: barRows.map((b) => b[0]), ...axisStyle() },
      series: [{ type: 'bar', data: barRows.map((b) => b[1]), barWidth: 18, itemStyle: { color: c.accent, borderRadius: [0, 6, 6, 0] }, label: { show: true, position: 'right', formatter: (p: any) => fmt(p.value, 1) + ' h', color: c.text } }],
    };
  }, [barRows, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoy = meta ? new Date(meta.hoy + 'T12:00:00').toLocaleDateString(useUI.getState().lang === 'en' ? 'en-US' : 'es-PE', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const waveLine = vigente ? t(`overview.wave.${vigente.estado}`, { n: vigente.ola.numero, from: vigente.ola.inicio, to: vigente.ola.fin, period: vigente.ola.periodo }) : '';

  return (
    <div className="space-y-4">
      <PageHeader title={t('overview.greeting')} subtitle={`${hoy} · ${waveLine}`} />
      <section aria-label={t('overview.kpis')} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kp.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        {kp.error && <div className="card sm:col-span-2 xl:col-span-4"><ErrorState error={kp.error} retry={() => kp.refetch()} /></div>}
        {kp.data?.kpis.map((k, i) => <KpiCard key={k.id} kpi={k} index={i} />)}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-1 text-section">{t('overview.evolution')}</h2>
          <p className="mb-2 text-label text-muted">{t('overview.evolutionHint')}</p>
          {kp.isLoading ? <Skeleton className="h-64" /> : k1 && k1.byOla.length ? (
            <Chart option={evo} height={260} label={t('overview.evolution')} table={{ columns: [t('common.wave'), 'SWLS'], rows: k1.byOla.map((x) => [x.grupo, Number(fmt(x.valor, 2).replace(',', '.'))]) }} />
          ) : <EmptyState title={t('common.noData')} hint={t('common.noDataHint')} />}
        </div>
        <aside className="card" aria-labelledby="hallazgos">
          <h2 id="hallazgos" className="mb-2 flex items-center gap-2 text-section"><Lightbulb size={16} strokeWidth={1.5} aria-hidden /> {t('overview.findings')}</h2>
          {heat.isLoading ? <Skeleton className="h-40" /> : findings.length ? (
            <ul className="space-y-2">
              {findings.map((f, i) => (
                <li key={i} className="flex gap-2 text-body">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${f.tone === 'info' ? 'bg-accent' : f.tone === 'good' ? 'bg-good' : f.tone === 'warn' ? 'bg-warn' : 'bg-bad'}`} aria-hidden />
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title={t('overview.noFindings')} />}
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-1 text-section">{t('overview.heat')}</h2>
          <p className="mb-2 text-label text-muted">{t('overview.heatHint')}</p>
          {heat.isLoading ? <Skeleton className="h-64" /> : heat.error ? <ErrorState error={heat.error} /> : (heat.data?.rows.length ? (
            <Chart option={heatOpt} height={280} label={t('overview.heat')} table={{ columns: [t('filters.school'), t('common.wave'), 'SWLS', 'n'], rows: heat.data.rows.map((r: any) => [r.Escuela, r.OlaMedicion, r.valor === null ? null : Number(fmt(r.valor, 2).replace(',', '.')), r.n]) }} />
          ) : <EmptyState title={t('common.noData')} hint={t('common.noDataHint')} />)}
        </div>
        <div className="card">
          <h2 className="mb-1 text-section">{t('overview.bars')}</h2>
          <p className="mb-2 text-label text-muted">{t('overview.barsHint')}</p>
          {bars.isLoading ? <Skeleton className="h-64" /> : barRows.length ? (
            <Chart option={barOpt} height={260} label={t('overview.bars')} table={{ columns: [t('explorer.dim.TipoVinculo'), 'h'], rows: barRows.map((b) => [b[0], Number(fmt(b[1], 2).replace(',', '.'))]) }} />
          ) : <EmptyState title={t('common.noData')} hint={t('common.noDataHint')} />}
        </div>
      </section>

      <details className="card group" onToggle={(e) => setRecsOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="flex min-h-[44px] cursor-pointer items-center text-section">{t('overview.recs')}</summary>
        <div className="mt-2">{recsOpen && kp.data && <Recs kpis={kp.data.kpis.map((k) => ({ id: k.id, valor: k.valor, estado: k.estado }))} auto />}</div>
      </details>
    </div>
  );
}
