import { ArrowDownToLine, ArrowUpFromLine, GripVertical, Link2, Save, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import Chart, { axisStyle, chartColors, palette } from '../components/Chart';
import { EmptyState, ErrorState, Field, Loading, PageHeader, Warning, toast, useTitle } from '../components/ui';
import { useExplore, useMeta } from '../lib/hooks';
import { fmt } from '../lib/util';
import { useUI } from '../lib/store';

type ChartKind = 'bar' | 'line' | 'heat' | 'table';
interface State {
  measure: string; rows: string[]; cols: string[]; chart: ChartKind;
  slicers: Record<string, string[]>; drill: Record<string, string>; stack: { dim: string; value: string; rows: string[] }[];
  cross?: { dim: string; value: string };
}
const INIT: State = { measure: 'PuntajeSWLS', rows: ['Escuela'], cols: ['OlaMedicion'], chart: 'bar', slicers: {}, drill: {}, stack: [] };
const HIER: string[][] = [['Facultad', 'Escuela'], ['Anual', 'Mes', 'Semana', 'Dia']];
const label = (r: any, dims: string[]) => dims.map((d) => r[d]).join(' · ');

const enc = (s: State) => btoa(unescape(encodeURIComponent(JSON.stringify(s))));
const dec = (v: string): State | null => { try { return { ...INIT, ...JSON.parse(decodeURIComponent(escape(atob(v)))) }; } catch { return null; } };
const SAVED = 'bienestar-views';
const loadSaved = (): { name: string; v: string }[] => { try { return JSON.parse(localStorage.getItem(SAVED) ?? '[]'); } catch { return []; } };

function Slicer({ dim, measure, selected, onChange }: { dim: string; measure: string; selected: string[]; onChange: (v: string[]) => void }) {
  const q = useExplore({ measure, rows: [dim], cols: [] });
  const vals: string[] = [...new Set<string>((q.data?.rows ?? []).map((r: any) => String(r[dim])))];
  const { t } = useTranslation();
  return (
    <fieldset className="rounded-card border border-line p-2">
      <legend className="px-1 text-label font-medium">{t(`explorer.dim.${dim}`)}</legend>
      <div className="flex flex-wrap gap-1">
        {vals.map((v) => {
          const on = selected.includes(v);
          return <button key={v} aria-pressed={on} onClick={() => onChange(on ? selected.filter((x) => x !== v) : [...selected, v])} className={`rounded-full border px-2.5 py-1 text-label ${on ? 'border-transparent bg-accent-strong text-on-accent' : 'border-line text-muted hover:text-fg'}`}>{v}</button>;
        })}
      </div>
    </fieldset>
  );
}

export default function Explorer() {
  const { t } = useTranslation();
  useTitle(t('nav.explorer'));
  const { data: meta } = useMeta();
  const [sp, setSp] = useSearchParams();
  const [s, setS] = useState<State>(() => (sp.get('v') ? dec(sp.get('v')!) ?? INIT : INIT));
  const [saved, setSaved] = useState(loadSaved);
  const [sliceDim, setSliceDim] = useState('');
  const theme = useUI((x) => x.theme);
  const dims = meta?.dimensiones ?? [];
  const fact = meta?.medidas.find((m) => m.id === s.measure)?.fact ?? 'bienestar';
  const compat = dims.filter((d) => d.facts.includes(fact));
  useEffect(() => { if (s) setSp((p) => { p.delete('v'); return p; }, { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const body = { measure: s.measure, rows: s.rows, cols: s.cols, slicers: s.slicers, drill: s.drill };
  const main = useExplore(body, s.rows.length + s.cols.length > 0);
  const secDim = fact === 'bienestar' ? 'OlaMedicion' : 'Mes';
  const crossSlicers = s.cross ? { ...s.slicers, [s.cross.dim]: [s.cross.value] } : s.slicers;
  const sec = useExplore({ measure: s.measure, rows: [secDim], cols: [], slicers: crossSlicers, drill: s.drill }, true);

  const patch = (p: Partial<State>) => setS((x) => ({ ...x, ...p }));
  const setMeasure = (m: string) => {
    const f = meta?.medidas.find((x) => x.id === m)?.fact ?? 'bienestar';
    const ok = (d: string) => dims.find((x) => x.id === d)?.facts.includes(f);
    patch({ measure: m, rows: s.rows.filter(ok), cols: s.cols.filter(ok), slicers: Object.fromEntries(Object.entries(s.slicers).filter(([d]) => ok(d))), drill: Object.fromEntries(Object.entries(s.drill).filter(([d]) => ok(d))), stack: [], cross: undefined });
  };
  const place = (d: string, zone: 'rows' | 'cols') => {
    const other = zone === 'rows' ? 'cols' : 'rows';
    if (s[zone].includes(d) || s[zone].length >= (zone === 'rows' ? 3 : 2)) return;
    patch({ [zone]: [...s[zone], d], [other]: s[other].filter((x) => x !== d) } as Partial<State>);
  };
  const onDrop = (zone: 'rows' | 'cols') => (e: React.DragEvent) => { e.preventDefault(); const d = e.dataTransfer.getData('text/plain'); if (d) place(d, zone); };

  const drillable = (d: string) => { const h = HIER.find((x) => x.includes(d)); return h && h.indexOf(d) < h.length - 1 ? h[h.indexOf(d) + 1] : null; };
  const drillDown = (dim: string, value: string) => {
    const next = drillable(dim);
    if (!next) return toast.error(t('explorer.noDeeper'));
    patch({ drill: { ...s.drill, [dim]: value }, rows: s.rows.map((r) => (r === dim ? next : r)), cols: s.cols.map((r) => (r === dim ? next : r)), stack: [...s.stack, { dim, value, rows: s.rows }], cross: undefined });
  };
  const drillUp = () => {
    const last = s.stack[s.stack.length - 1];
    if (!last) return;
    const drill = { ...s.drill }; delete drill[last.dim];
    patch({ drill, rows: last.rows, stack: s.stack.slice(0, -1), cross: undefined });
  };

  const rows: any[] = main.data?.rows ?? [];
  const rowDims = s.rows, colDims = s.cols;
  const cats = useMemo(() => [...new Set(rows.map((r) => label(r, rowDims)))], [rows, rowDims]);
  const sers = useMemo(() => (colDims.length ? [...new Set(rows.map((r) => label(r, colDims)))] : ['·']), [rows, colDims]);
  const get = (c: string, sr: string) => { const r = rows.find((x) => label(x, rowDims) === c && (colDims.length ? label(x, colDims) === sr : true)); return r; };
  const title = meta?.medidas.find((m) => m.id === s.measure)?.label ?? s.measure;
  const mLabel = t(`explorer.measure.${s.measure}`, { defaultValue: title });

  const option = useMemo(() => {
    const c = chartColors();
    if (s.chart === 'heat') {
      const data: any[] = [];
      cats.forEach((cc, y) => sers.forEach((sr, x) => { const r = get(cc, sr); if (r && r.valor !== null) data.push([x, y, Number(r.valor.toFixed(3))]); }));
      const vals = data.map((d) => d[2]);
      return {
        grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
        tooltip: { formatter: (p: any) => `${cats[p.value[1]]} · ${sers[p.value[0]]}<br/><b>${fmt(p.value[2], 2)}</b>` },
        xAxis: { type: 'category', data: sers, ...axisStyle() }, yAxis: { type: 'category', data: cats, inverse: true, ...axisStyle() },
        visualMap: { min: Math.min(...vals, 0), max: Math.max(...vals, 1), calculable: false, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: [c.surface, c.accent] }, textStyle: { color: c.muted } },
        series: [{ type: 'heatmap', data, label: { show: data.length < 80, formatter: (p: any) => fmt(p.value[2], 1), color: c.text }, itemStyle: { borderColor: c.surface, borderWidth: 2, borderRadius: 4 } }],
      };
    }
    const kind = s.chart === 'line' ? 'line' : 'bar';
    return {
      color: palette,
      grid: { left: 8, right: 16, top: sers.length > 1 ? 36 : 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v, 2) },
      legend: sers.length > 1 ? { top: 0, textStyle: { color: c.muted } } : undefined,
      xAxis: { type: 'category', data: cats, ...axisStyle(), axisLabel: { color: c.muted, interval: 0, rotate: cats.length > 8 ? 40 : 0 } },
      yAxis: { type: 'value', ...axisStyle() },
      series: sers.map((sr, i) => ({
        name: sr === '·' ? mLabel : sr, type: kind, smooth: true, barMaxWidth: 36,
        data: cats.map((cc) => { const r = get(cc, sr); const v = r?.valor ?? null; const sel = s.cross && s.rows[0] && cc === s.cross.value; return { value: v, itemStyle: kind === 'bar' ? { borderRadius: [6, 6, 0, 0], opacity: s.cross && !sel ? 0.35 : 1 } : undefined }; }),
        label: sers.length === 1 && cats.length <= 12 ? { show: true, position: 'top', formatter: (p: any) => (p.value === null ? '' : fmt(p.value, 1)), color: c.text } : undefined,
        itemStyle: { color: palette[i % palette.length] },
      })),
    };
  }, [rows, s.chart, s.cross, cats, sers, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const secRows: any[] = sec.data?.rows ?? [];
  const secOpt = useMemo(() => {
    const c = chartColors();
    return {
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v, 2) },
      xAxis: { type: 'category', data: secRows.map((r) => r[secDim]), ...axisStyle() }, yAxis: { type: 'value', ...axisStyle() },
      series: [{ type: 'line', smooth: true, data: secRows.map((r) => r.valor), lineStyle: { color: c.accent, width: 2 }, itemStyle: { color: c.accent }, symbolSize: 7 }],
    };
  }, [secRows, secDim, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = () => {
    const url = `${location.origin}${location.pathname}?v=${enc(s)}`;
    navigator.clipboard?.writeText(url);
    toast.ok(t('explorer.linkCopied'));
  };
  const save = () => {
    const name = prompt(t('explorer.saveName'), `${mLabel}`);
    if (!name) return;
    const next = [...saved.filter((x) => x.name !== name), { name, v: enc(s) }];
    localStorage.setItem(SAVED, JSON.stringify(next)); setSaved(next); toast.ok(t('explorer.saved'));
  };
  const onClick = (p: any) => {
    const dim = s.rows[0];
    if (!dim) return;
    const value = String(cats[p.dataIndex ?? p.value?.[1]] ?? p.name);
    const first = value.split(' · ')[0];
    patch({ cross: s.cross?.value === first ? undefined : { dim, value: first } });
  };

  const tableCols = [...rowDims, ...(colDims.length ? sers : ['valor'])];
  const fmtCell = (r: any) => (r?.suppressed ? 'k' : r?.valor == null ? '—' : fmt(r.valor, 2));

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.explorer')} subtitle={t('explorer.subtitle')} actions={<>
        <button className="btn" onClick={share}><Link2 size={14} /> {t('explorer.share')}</button>
        <button className="btn" onClick={save}><Save size={14} /> {t('explorer.save')}</button>
      </>} />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="card space-y-4" aria-label={t('explorer.fields')}>
          <Field label={t('explorer.measureLabel')}>
            <select className="input" value={s.measure} onChange={(e) => setMeasure(e.target.value)}>
              {(meta?.medidas ?? []).map((m) => <option key={m.id} value={m.id}>{t(`explorer.measure.${m.id}`, { defaultValue: m.label })}</option>)}
            </select>
          </Field>
          <div>
            <p className="label mb-1">{t('explorer.dimensions')}</p>
            <ul className="flex flex-wrap gap-1.5">
              {compat.map((d) => (
                <li key={d.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', d.id)} className="flex items-center gap-1 rounded-ctl border border-line bg-bg py-0.5 pl-1 pr-0.5 text-label">
                  <GripVertical size={12} className="cursor-grab text-muted" aria-hidden />
                  {t(`explorer.dim.${d.id}`, { defaultValue: d.label })}
                  <button className="rounded px-1 text-muted hover:text-fg" onClick={() => place(d.id, 'rows')} title={t('explorer.toRows')} aria-label={`${d.label}: ${t('explorer.toRows')}`}>↓</button>
                  <button className="rounded px-1 text-muted hover:text-fg" onClick={() => place(d.id, 'cols')} title={t('explorer.toCols')} aria-label={`${d.label}: ${t('explorer.toCols')}`}>→</button>
                </li>
              ))}
            </ul>
          </div>
          {(['rows', 'cols'] as const).map((z) => (
            <div key={z} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(z)} className="min-h-[56px] rounded-card border border-dashed border-line p-2">
              <p className="label mb-1">{t(`explorer.${z}`)}</p>
              <div className="flex flex-wrap gap-1.5">
                {s[z].length === 0 && <span className="text-label text-muted">{t('explorer.dropHere')}</span>}
                {s[z].map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-label text-accent-strong">
                    {t(`explorer.dim.${d}`, { defaultValue: d })}
                    <button onClick={() => patch({ [z]: s[z].filter((x) => x !== d) } as Partial<State>)} aria-label={t('common.remove')}><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          ))}
          <Field label={t('explorer.chartType')}>
            <select className="input" value={s.chart} onChange={(e) => patch({ chart: e.target.value as ChartKind })}>
              {(['bar', 'line', 'heat', 'table'] as const).map((k) => <option key={k} value={k}>{t(`explorer.chart.${k}`)}</option>)}
            </select>
          </Field>
          {saved.length > 0 && (
            <Field label={t('explorer.savedViews')}>
              <select className="input" value="" onChange={(e) => { const v = saved.find((x) => x.name === e.target.value); if (v) { const st = dec(v.v); if (st) setS(st); } }}>
                <option value="">—</option>{saved.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
              </select>
            </Field>
          )}
        </aside>

        <div className="space-y-4">
          <section className="card" aria-label={t('explorer.slicers')}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-section">{t('explorer.slicers')}</h2>
              <select className="input !w-auto" value={sliceDim} onChange={(e) => setSliceDim(e.target.value)} aria-label={t('explorer.addSlicer')}>
                <option value="">+ {t('explorer.addSlicer')}</option>
                {compat.filter((d) => !['Dia', 'Semana'].includes(d.id)).map((d) => <option key={d.id} value={d.id}>{t(`explorer.dim.${d.id}`, { defaultValue: d.label })}</option>)}
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...new Set([...(sliceDim ? [sliceDim] : []), ...Object.keys(s.slicers)])].map((d) => (
                <div key={d} className="relative">
                  <Slicer dim={d} measure={s.measure} selected={s.slicers[d] ?? []} onChange={(v) => patch({ slicers: { ...s.slicers, [d]: v } })} />
                </div>
              ))}
              {!sliceDim && !Object.keys(s.slicers).length && <p className="text-label text-muted">{t('explorer.noSlicers')}</p>}
            </div>
          </section>

          <section className="card" aria-labelledby="ex-title">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 id="ex-title" className="mr-auto text-section">{mLabel}</h2>
              {Object.entries(s.drill).map(([d, v]) => <span key={d} className="rounded-full border border-line px-2 py-0.5 text-label">{t(`explorer.dim.${d}`)}: <b>{v}</b></span>)}
              {s.stack.length > 0 && <button className="btn" onClick={drillUp}><ArrowUpFromLine size={14} /> {t('explorer.drillUp')}</button>}
              {s.cross && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-label text-accent-strong">{t('explorer.cross')}: {s.cross.value}
                    <button onClick={() => patch({ cross: undefined })} aria-label={t('common.remove')}><X size={12} /></button></span>
                  {drillable(s.cross.dim) && <button className="btn" onClick={() => drillDown(s.cross!.dim, s.cross!.value)}><ArrowDownToLine size={14} /> {t('explorer.drillDown')}</button>}
                </>
              )}
            </div>
            {main.isLoading && <Loading rows={4} />}
            {main.error && <ErrorState error={main.error} retry={() => main.refetch()} />}
            {!main.isLoading && !main.error && (rowDims.length + colDims.length === 0 ? <EmptyState title={t('explorer.emptyTitle')} hint={t('explorer.emptyHint')} /> : rows.length === 0 ? <EmptyState title={t('common.noData')} hint={t('common.noDataHint')} /> : s.chart === 'table' ? (
              <div className="overflow-auto rounded-card border border-line">
                <table className="w-full min-w-[480px] text-left tnum">
                  <thead className="bg-bg text-label text-muted"><tr>{rowDims.map((d) => <th key={d} className="px-3 py-2">{t(`explorer.dim.${d}`)}</th>)}{(colDims.length ? sers : [mLabel]).map((c) => <th key={c} className="px-3 py-2 text-right">{c}</th>)}</tr></thead>
                  <tbody>{[...new Set(rows.map((r) => rowDims.map((d) => r[d]).join('¦')))].map((k) => {
                    const first = rows.find((r) => rowDims.map((d) => r[d]).join('¦') === k);
                    return <tr key={k} className="border-t border-line">{rowDims.map((d) => <td key={d} className="px-3 py-1.5">{first[d]}</td>)}{(colDims.length ? sers : ['·']).map((sr) => <td key={sr} className="px-3 py-1.5 text-right">{fmtCell(get(label(first, rowDims), sr))}</td>)}</tr>;
                  })}</tbody>
                </table>
              </div>
            ) : (
              <Chart option={option} height={320} label={`${mLabel}`} onClick={onClick}
                table={{ columns: tableCols.map((c) => t(`explorer.dim.${c}`, { defaultValue: c })), rows: cats.map((cc) => [...cc.split(' · '), ...(colDims.length ? sers : ['·']).map((sr) => { const r = get(cc, sr); return r?.suppressed ? 'k' : r?.valor == null ? null : Number(r.valor.toFixed(2)); })]) }} />
            ))}
            <p className="mt-1 text-label text-muted">{t('explorer.clickHint')}</p>
          </section>

          <section className="card">
            <h2 className="mb-1 text-section">{t('explorer.secondary', { dim: t(`explorer.dim.${secDim}`) })}</h2>
            {sec.isLoading ? <Loading rows={2} /> : secRows.length ? <Chart option={secOpt} height={200} label={t('explorer.secondary', { dim: secDim })} table={{ columns: [secDim, mLabel], rows: secRows.map((r) => [r[secDim], r.valor === null ? null : Number(r.valor.toFixed(2))]) }} /> : <EmptyState title={t('common.noData')} />}
          </section>
          <Warning>{t('explorer.warning')}</Warning>
        </div>
      </div>
    </div>
  );
}
