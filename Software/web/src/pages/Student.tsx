import * as Slider from '@radix-ui/react-slider';
import * as Tabs from '@radix-ui/react-tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Chart, { axisStyle, chartColors } from '../components/Chart';
import Recs from '../components/Recs';
import { EmptyState, ErrorState, Field, Loading, PageHeader, Warning, toast, useTitle } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useMeta } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { useUI } from '../lib/store';
import { estadoDe, fmt } from '../lib/util';

const today = (hoy?: string) => hoy ?? new Date().toISOString().slice(0, 10);

function useMe(cod: number | null) {
  return useQuery({ queryKey: ['me', cod], queryFn: () => api<any>('/api/me'), enabled: !!cod });
}
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : String((e as Error).message));

function SurveyWizard({ cod, me }: { cod: number; me: any }) {
  const { t } = useTranslation();
  const { data: meta } = useMeta();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [vals, setVals] = useState<number[]>([4, 4, 4, 4, 4]);
  const done = new Set<number>((me?.encuestas ?? []).map((e: any) => e.ola));
  const pending = (meta?.olas ?? []).filter((o) => !done.has(o.numero));
  const [olaSel, setOlaSel] = useState<number | null>(null);
  const ola = pending.find((o) => o.numero === olaSel) ?? pending[0];
  const hoy = today(meta?.hoy);
  const fecha = ola ? (hoy < ola.inicio ? ola.inicio : hoy > ola.fin ? ola.fin : hoy) : hoy;
  const [touched, setTouched] = useState<boolean[]>([false, false, false, false, false]);
  const m = useMutation({
    mutationFn: () => api('/api/log/survey', { method: 'POST', body: JSON.stringify({ fecha, respuestas: vals }) }),
    onSuccess: (r: any) => { toast.ok(t('student.surveyOk', { score: r.puntaje, n: r.ola })); qc.invalidateQueries({ queryKey: ['me', cod] }); setStep(0); setTouched([false, false, false, false, false]); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!ola) return <EmptyState title={t('student.allDone')} hint={t('student.allDoneHint')} />;
  const items = [1, 2, 3, 4, 5];
  const last = step === 4;
  return (
    <div className="space-y-4">
      {pending.length > 1 && (
        <Field label={t('student.pickWave')}>
          <select className="input !w-auto" value={ola.numero} onChange={(e) => setOlaSel(Number(e.target.value))}>{pending.map((o) => <option key={o.numero} value={o.numero}>{t('common.wave')} {o.numero} ({o.inicio} → {o.fin})</option>)}</select>
        </Field>
      )}
      <p className="text-label text-muted">{t('student.surveyDate', { date: fecha, n: ola.numero })}</p>
      <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step + 1} aria-label={t('student.step', { n: step + 1 })}>
        {items.map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i - 1 <= step ? 'bg-accent' : 'bg-line'}`} />)}
      </div>
      <fieldset>
        <legend className="mb-1 text-label text-muted">{t('student.step', { n: step + 1 })}</legend>
        <p className="mb-4 text-section">{t(`swls.${step + 1}`)}</p>
        <Slider.Root className="relative flex h-8 w-full touch-none select-none items-center" min={1} max={7} step={1} value={[vals[step]]}
          onValueChange={([v]) => { setVals((x) => x.map((y, i) => (i === step ? v : y))); setTouched((x) => x.map((y, i) => (i === step ? true : y))); }} aria-label={t(`swls.${step + 1}`)}>
          <Slider.Track className="relative h-2 grow rounded-full bg-line"><Slider.Range className="absolute h-full rounded-full bg-accent" /></Slider.Track>
          <Slider.Thumb className="block h-6 w-6 rounded-full border-2 border-accent bg-surface shadow focus-visible:outline-2" />
        </Slider.Root>
        <div className="mt-1 flex justify-between text-label text-muted"><span>1 · {t('student.disagree')}</span><b className="text-fg tnum">{vals[step]}</b><span>7 · {t('student.agree')}</span></div>
      </fieldset>
      <div className="flex items-center justify-between">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>{t('common.back')}</button>
        {last ? <button className="btn btn-primary" disabled={m.isPending || touched.some((x) => !x)} onClick={() => m.mutate()}>{t('student.submit')} · {vals.reduce((a, b) => a + b, 0)}/35</button> : <button className="btn btn-primary" disabled={!touched[step]} onClick={() => setStep(step + 1)}>{t('common.next')}</button>}
      </div>
      {last && touched.some((x) => !x) && <p className="text-label text-bad-t" role="alert">{t('student.mustAnswer')}</p>}
    </div>
  );
}

function InteractionForm({ cod }: { cod: number }) {
  const { t } = useTranslation();
  const { data: meta } = useMeta();
  const qc = useQueryClient();
  const [f, setF] = useState({ id_vinculo: 1, id_modalidad: 1, duracion_horas: 1, valoracion: 4, fecha: '' });
  const fecha = f.fecha || today(meta?.hoy);
  const m = useMutation({
    mutationFn: () => api('/api/log/interaction', { method: 'POST', body: JSON.stringify({ ...f, fecha, duracion_horas: Number(f.duracion_horas), valoracion: Number(f.valoracion) }) }),
    onSuccess: () => { toast.ok(t('student.saved')); qc.invalidateQueries({ queryKey: ['me', cod] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const bad = !(Number(f.duracion_horas) > 0 && Number(f.duracion_horas) <= 24);
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!bad) m.mutate(); }}>
      <Field label={t('student.bond')}><select className="input" value={f.id_vinculo} onChange={(e) => setF({ ...f, id_vinculo: Number(e.target.value) })}>{meta?.vinculos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}</select></Field>
      <Field label={t('student.modality')}><select className="input" value={f.id_modalidad} onChange={(e) => setF({ ...f, id_modalidad: Number(e.target.value) })}>{meta?.modalidades.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}</select></Field>
      <Field label={t('student.hours')} hint={bad ? t('student.hoursErr') : undefined}><input className="input" type="number" step="0.25" min="0.25" max="24" value={f.duracion_horas} onChange={(e) => setF({ ...f, duracion_horas: e.target.value as any })} aria-invalid={bad} /></Field>
      <Field label={t('student.rating')}>
        <div className="flex gap-1" role="radiogroup" aria-label={t('student.rating')}>
          {[1, 2, 3, 4, 5].map((v) => <button type="button" key={v} role="radio" aria-checked={f.valoracion === v} onClick={() => setF({ ...f, valoracion: v })} className={`touch flex-1 rounded-ctl border text-body ${f.valoracion === v ? 'border-transparent bg-accent-strong text-on-accent' : 'border-line'}`}>{v}</button>)}
        </div>
      </Field>
      <Field label={t('student.date')}><input className="input" type="date" value={fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
      <div className="flex items-end"><button className="btn btn-primary w-full" disabled={m.isPending || bad}>{t('student.save')}</button></div>
      <p className="text-label text-muted sm:col-span-2">{t('student.interHint')}</p>
    </form>
  );
}

function ActivityForm({ cod }: { cod: number }) {
  const { t } = useTranslation();
  const { data: meta } = useMeta();
  const qc = useQueryClient();
  const [f, setF] = useState({ id_actividad: 1, duracion_min: 30, fecha: '' });
  const fecha = f.fecha || today(meta?.hoy);
  const m = useMutation({
    mutationFn: () => api('/api/log/activity', { method: 'POST', body: JSON.stringify({ id_actividad: f.id_actividad, duracion_min: Number(f.duracion_min), fecha }) }),
    onSuccess: (r: any) => { toast.ok(r.cuenta_para_kpi ? t('student.saved') : t('student.savedShort')); qc.invalidateQueries({ queryKey: ['me', cod] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const bad = !(Number(f.duracion_min) > 0 && Number(f.duracion_min) <= 600);
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!bad) m.mutate(); }}>
      <Field label={t('student.activity')}><select className="input" value={f.id_actividad} onChange={(e) => setF({ ...f, id_actividad: Number(e.target.value) })}>{meta?.actividades.map((a) => <option key={a.id} value={a.id}>{a.nombre} · {a.intensidad}</option>)}</select></Field>
      <Field label={t('student.minutes')} hint={bad ? t('student.minutesErr') : undefined}><input className="input" type="number" min="1" max="600" value={f.duracion_min} onChange={(e) => setF({ ...f, duracion_min: e.target.value as any })} aria-invalid={bad} /></Field>
      <Field label={t('student.date')}><input className="input" type="date" value={fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
      <div className="flex items-end"><button className="btn btn-primary w-full" disabled={m.isPending || bad}>{t('student.save')}</button></div>
      <p className="text-label text-muted sm:col-span-2">{t('student.actHint')}</p>
    </form>
  );
}

export default function Student() {
  const { t } = useTranslation();
  useTitle(t('nav.student'));
  const { data: meta } = useMeta();
  const cod = useAuth((s) => s.user?.cod_estudiante) ?? null;
  const theme = useUI((s) => s.theme);
  const me = useMe(cod);
  const group = useQuery({ queryKey: ['kpis-group'], queryFn: () => api<{ kpis: any[] }>(`/api/kpis?k=${useUI.getState().k}`) });
  const u = useMemo(() => Object.fromEntries((meta?.kpis ?? []).map((k) => [k.id, k])), [meta]);

  const p = me.data?.personal;
  const personal = p ? { 'KPI-01': p.swls, 'KPI-02': p.horas, 'KPI-03': p.valoracion, 'KPI-04': p.dias } as Record<string, number | null> : null;
  const g = Object.fromEntries((group.data?.kpis ?? []).map((k: any) => [k.id, k.valor])) as Record<string, number | null>;

  const radar = useMemo(() => {
    if (!personal || !meta) return null;
    const c = chartColors();
    const ids = ['KPI-01', 'KPI-02', 'KPI-03', 'KPI-04'];
    const pct = (id: string, v: number | null) => (v === null || !u[id] ? 0 : Math.min(130, (v / u[id].umbral_bueno) * 100));
    return {
      tooltip: {},
      legend: { bottom: 0, textStyle: { color: c.muted } },
      radar: { indicator: ids.map((id) => ({ name: t(`kpi.${id}`), max: 130 })), radius: '62%', axisName: { color: c.muted, fontSize: 11 }, splitLine: { lineStyle: { color: c.border } }, splitArea: { show: false }, axisLine: { lineStyle: { color: c.border } } },
      series: [{ type: 'radar', data: [
        { name: t('student.you'), value: ids.map((id) => pct(id, personal[id])), itemStyle: { color: c.accent }, areaStyle: { opacity: 0.2 } },
        { name: t('student.group'), value: ids.map((id) => pct(id, g[id] ?? null)), itemStyle: { color: '#64748B' }, lineStyle: { type: 'dashed' } },
      ] }],
    };
  }, [personal, g, meta, theme, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const line = useMemo(() => {
    const c = chartColors();
    const grp = (group.data?.kpis.find((k: any) => k.id === 'KPI-01')?.byOla ?? []) as { grupo: string; valor: number }[];
    const mine = me.data?.encuestas ?? [];
    return {
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { color: c.muted } },
      xAxis: { type: 'category', data: [1, 2, 3].map((n) => `${t('common.wave')} ${n}`), ...axisStyle() },
      yAxis: { type: 'value', min: 5, max: 35, ...axisStyle() },
      series: [
        { name: t('student.you'), type: 'line', symbolSize: 9, data: [1, 2, 3].map((n) => mine.find((e: any) => e.ola === n)?.puntaje ?? null), itemStyle: { color: c.accent }, lineStyle: { width: 3, color: c.accent }, label: { show: true, color: c.text }, connectNulls: true },
        { name: t('student.group'), type: 'line', data: [1, 2, 3].map((n) => grp.find((x) => Number(x.grupo) === n)?.valor ?? null), itemStyle: { color: '#64748B' }, lineStyle: { type: 'dashed', color: '#64748B' } },
      ],
    };
  }, [me.data, group.data, theme, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const feed = useMemo(() => {
    const i = (me.data?.interacciones ?? []).map((x: any) => ({ fecha: x.fecha, kind: 'i', text: `${x.tipo} · ${fmt(x.horas, 1)} h · ★${x.valoracion}` }));
    const a = (me.data?.actividades ?? []).map((x: any) => ({ fecha: x.fecha, kind: 'a', text: `${x.actividad} · ${x.minutos} min${x.minutos < 10 ? ` (${t('student.under10')})` : ''}` }));
    return [...i, ...a].sort((x, y) => y.fecha.localeCompare(x.fecha)).slice(0, 14);
  }, [me.data, t]);

  const coachKpis = personal ? Object.entries(personal).map(([id, v]) => ({ id, valor: v, estado: estadoDe(v, u[id]) ?? null })) : [];
  const tabCls = 'min-h-[44px] border-b-2 border-transparent px-3 text-body text-muted data-[state=active]:border-accent-strong data-[state=active]:text-fg';

  return (
    <div className="space-y-4">
      <PageHeader title={t('student.title')} subtitle={t('student.subtitle')} actions={<span className="rounded-full border border-line px-2.5 py-1 text-label text-muted tnum">{t('student.code')}: {cod}</span>} />
      {me.isLoading && <Loading rows={4} />}
      {me.error && <div className="card"><ErrorState error={me.error} retry={() => me.refetch()} /></div>}
      {me.data && cod && (
        <Tabs.Root defaultValue="resumen">
          <Tabs.List className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
            {['resumen', 'encuesta', 'interaccion', 'actividad', 'coach'].map((k) => <Tabs.Trigger key={k} value={k} className={tabCls}>{t(`student.tab.${k}`)}</Tabs.Trigger>)}
          </Tabs.List>
          <Tabs.Content value="resumen" className="grid gap-4 lg:grid-cols-3">
            <div className="card">
              <h2 className="text-section">{t('student.radar')}</h2>
              <p className="mb-1 text-label text-muted">{t('student.radarHint')}</p>
              {radar && <Chart option={radar} height={280} label={t('student.radar')} table={{ columns: ['KPI', t('student.you'), t('student.group')], rows: Object.keys(personal!).map((id) => [id, personal![id] === null ? null : Number(fmt(personal![id]!, 2).replace(',', '.')), g[id] == null ? null : Number(fmt(g[id]!, 2).replace(',', '.'))]) }} />}
              <p className="mt-1 text-label text-muted">{t('student.afterEtl')}</p>
            </div>
            <div className="card">
              <h2 className="text-section">{t('student.timeline')}</h2>
              <Chart option={line} height={260} label={t('student.timeline')} table={{ columns: [t('common.wave'), t('student.you')], rows: me.data.encuestas.map((e: any) => [e.ola, e.puntaje]) }} />
              <div className="mt-3 flex items-center gap-3 rounded-card bg-bg p-3">
                <Flame className={me.data.racha > 0 ? 'text-warn-t' : 'text-muted'} size={28} strokeWidth={1.5} aria-hidden />
                <div><p className="text-section tnum">{t('student.streak', { count: me.data.racha })}</p><p className="text-label text-muted">{me.data.ultimoDiaActividad ? t('student.lastDay', { date: me.data.ultimoDiaActividad }) : t('student.noActivity')}</p></div>
              </div>
            </div>
            <div className="card">
              <h2 className="mb-2 text-section">{t('student.recent')}</h2>
              {feed.length ? <ul className="space-y-1.5">{feed.map((f, i) => <li key={i} className="flex gap-2 text-body"><span className="w-20 shrink-0 text-label text-muted tnum">{f.fecha}</span><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${f.kind === 'i' ? 'bg-accent' : 'bg-warn'}`} aria-hidden /><span>{f.text}</span></li>)}</ul> : <EmptyState title={t('student.noRecords')} />}
            </div>
          </Tabs.Content>
          <Tabs.Content value="encuesta" className="card max-w-2xl"><h2 className="mb-3 text-section">{t('student.surveyTitle')}</h2><SurveyWizard cod={cod} me={me.data} /></Tabs.Content>
          <Tabs.Content value="interaccion" className="card max-w-2xl"><h2 className="mb-3 text-section">{t('student.interTitle')}</h2><InteractionForm cod={cod} /></Tabs.Content>
          <Tabs.Content value="actividad" className="card max-w-2xl"><h2 className="mb-3 text-section">{t('student.actTitle')}</h2><ActivityForm cod={cod} /></Tabs.Content>
          <Tabs.Content value="coach" className="card max-w-2xl">
            <h2 className="mb-1 text-section">{t('student.coachTitle')}</h2>
            <p className="mb-3 text-label text-muted">{t('student.coachHint')}</p>
            <Recs kpis={coachKpis} title={t('student.coachTitle')} />
          </Tabs.Content>
        </Tabs.Root>
      )}
    </div>
  );
}
