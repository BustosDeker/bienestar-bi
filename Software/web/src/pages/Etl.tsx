import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Chart, { chartColors } from '../components/Chart';
import { EmptyState, ErrorState, Loading, PageHeader, toast, useTitle } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useUI } from '../lib/store';
import { fmt } from '../lib/util';

const SRC = ['ESTUDIANTE', 'ESCUELA / FACULTAD', 'ENCUESTA_BIENESTAR', 'RESPUESTA_SWLS', 'REGISTRO_INTERACCION', 'REGISTRO_ACTIVIDAD', 'Catálogos (vínculo, actividad)', 'PERIODO / OLA'];
const VIEWS = ['v_datosEstudiante', 'v_datosProgramaAcademico', 'v_datosTiempo', 'v_datosInteraccion', 'v_datosActividad'];
const LINKS: [string, string][] = [
  ['ESTUDIANTE', 'v_datosEstudiante'], ['ESCUELA / FACULTAD', 'v_datosProgramaAcademico'], ['PERIODO / OLA', 'v_datosTiempo'],
  ['ENCUESTA_BIENESTAR', 'v_datosTiempo'], ['REGISTRO_INTERACCION', 'v_datosTiempo'], ['REGISTRO_ACTIVIDAD', 'v_datosTiempo'],
  ['Catálogos (vínculo, actividad)', 'v_datosInteraccion'], ['Catálogos (vínculo, actividad)', 'v_datosActividad'],
  ['v_datosEstudiante', 'usp_ETL_Dimensiones'], ['v_datosProgramaAcademico', 'usp_ETL_Dimensiones'], ['v_datosTiempo', 'usp_ETL_Dimensiones'], ['v_datosInteraccion', 'usp_ETL_Dimensiones'], ['v_datosActividad', 'usp_ETL_Dimensiones'],
  ['usp_ETL_Dimensiones', 'DimEstudiante'], ['usp_ETL_Dimensiones', 'DimProgramaAcademico'], ['usp_ETL_Dimensiones', 'DimTiempo'], ['usp_ETL_Dimensiones', 'DimInteraccionSocial'], ['usp_ETL_Dimensiones', 'DimActividad'],
  ['ENCUESTA_BIENESTAR', 'usp_ETL_Hechos'], ['RESPUESTA_SWLS', 'usp_ETL_Hechos'], ['REGISTRO_INTERACCION', 'usp_ETL_Hechos'], ['REGISTRO_ACTIVIDAD', 'usp_ETL_Hechos'],
  ['DimEstudiante', 'usp_ETL_Hechos'], ['DimTiempo', 'usp_ETL_Hechos'], ['DimProgramaAcademico', 'usp_ETL_Hechos'],
  ['usp_ETL_Hechos', 'Hecho_Bienestar'], ['usp_ETL_Hechos', 'Hecho_Interaccion'], ['usp_ETL_Hechos', 'Hecho_Actividad'],
];

const dur = (ms: number | null) => (ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${fmt(ms / 1000, 1)} s`);

function Lineage() {
  const { t } = useTranslation();
  const theme = useUI((s) => s.theme);
  const [sel, setSel] = useState<string | null>(null);
  const layer = (n: string) => (SRC.includes(n) ? 0 : VIEWS.includes(n) ? 1 : n.startsWith('usp_') ? 2 : 3);
  const option = useMemo(() => {
    const c = chartColors();
    const names = [...new Set(LINKS.flat())];
    const colors = ['#64748B', '#3B82F6', '#F59E0B', '#0F9D8A'];
    return {
      tooltip: { trigger: 'item' },
      series: [{
        type: 'sankey', left: 8, right: 130, top: 8, bottom: 8, nodeWidth: 14, nodeGap: 10, draggable: false, emphasis: { focus: 'adjacency' },
        label: { color: c.text, fontSize: 11 }, lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
        data: names.map((n) => ({ name: n, depth: layer(n), itemStyle: { color: colors[layer(n)], opacity: !sel || sel === n ? 1 : 0.85 } })),
        links: LINKS.map(([source, target]) => ({ source, target, value: 1 })),
      }],
    };
  }, [theme, sel]);
  const up = sel ? LINKS.filter((l) => l[1] === sel).map((l) => l[0]) : [];
  const down = sel ? LINKS.filter((l) => l[0] === sel).map((l) => l[1]) : [];
  return (
    <section className="card">
      <h2 className="text-section">{t('etl.lineage')}</h2>
      <p className="mb-2 text-label text-muted">{t('etl.lineageHint')}</p>
      <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-label text-muted" aria-hidden>
        {[['#64748B', 'OLTP'], ['#3B82F6', t('etl.views')], ['#F59E0B', 'ETL'], ['#0F9D8A', 'Data Mart']].map(([c, l]) => <li key={l} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}</li>)}
      </ul>
      <Chart option={option} height={460} label={t('etl.lineage')} onClick={(p) => p.dataType === 'node' && setSel(p.name)}
        table={{ columns: [t('etl.from'), t('etl.to')], rows: LINKS }} />
      {sel && (
        <div className="mt-2 rounded-card bg-bg p-3 text-body" role="status">
          <b>{sel}</b>
          <p className="text-label text-muted">{t('etl.upstream')}: {up.length ? up.join(', ') : '—'}</p>
          <p className="text-label text-muted">{t('etl.downstream')}: {down.length ? down.join(', ') : '—'}</p>
        </div>
      )}
    </section>
  );
}

export default function Etl() {
  const { t } = useTranslation();
  useTitle(t('nav.etl'));
  const qc = useQueryClient();
  const runs = useQuery({ queryKey: ['etl-runs'], queryFn: () => api<any[]>('/api/etl/runs?limit=30') });
  const dq = useQuery({ queryKey: ['dq'], queryFn: () => api<any[]>('/api/dq') });
  const [last, setLast] = useState<any | null>(null);
  const run = useMutation({
    mutationFn: () => api<any>('/api/etl/run', { method: 'POST', body: '{}' }),
    onSuccess: (r) => { setLast(r); toast[r.ok ? 'ok' : 'error'](r.ok ? t('etl.ok') : t('etl.fail')); qc.invalidateQueries(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : String(e)),
  });
  const stepCls = (e: string) => (e === 'OK' ? 'text-good-t' : e === 'ERROR' ? 'text-bad-t' : 'text-warn-t');

  return (
    <div className="space-y-4">
      <PageHeader title={t('etl.title')} subtitle={t('etl.subtitle')} actions={
        <button className="btn btn-primary" onClick={() => run.mutate()} disabled={run.isPending}>
          <Play size={14} strokeWidth={1.5} /> {run.isPending ? t('etl.running') : t('etl.run')}
        </button>} />

      <section className="card" aria-live="polite">
        <h2 className="mb-2 text-section">{t('etl.lastRun')}</h2>
        {run.isPending && <Loading rows={2} />}
        {!run.isPending && !last && <EmptyState title={t('etl.noRun')} hint={t('etl.noRunHint')} />}
        {last && (
          <div className="overflow-auto">
            <table className="w-full min-w-[560px] text-left tnum">
              <thead className="text-label text-muted"><tr>{['step', 'read', 'inserted', 'rejected', 'duration', 'status'].map((c) => <th key={c} className="px-2 py-1.5">{t(`etl.col.${c}`)}</th>)}</tr></thead>
              <tbody>{last.steps.map((s: any, i: number) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-2 py-2 font-medium">{i + 1}. {s.paso}</td><td className="px-2">{s.leidas ?? '—'}</td><td className="px-2">{s.insertadas ?? '—'}</td><td className="px-2">{s.rechazadas ?? '—'}</td><td className="px-2">{dur(s.ms)}</td>
                  <td className={`px-2 font-medium ${stepCls(s.estado)}`}>{s.estado}{s.mensaje ? ` · ${s.mensaje}` : ''}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-1 text-section">{t('etl.dq')}</h2>
          <p className="mb-2 text-label text-muted">{t('etl.dqHint')}</p>
          {dq.isLoading && <Loading />}
          {dq.error && <ErrorState error={dq.error} retry={() => dq.refetch()} />}
          <ul className="divide-y divide-line">
            {(dq.data ?? []).map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex items-baseline justify-between gap-2"><span><b>{r.id}</b> · {t(`dq.${r.rule}`)}</span>
                  <span className={`tnum ${r.violations ? 'text-warn-t' : 'text-good-t'}`}>{r.violations} / {r.total}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden><div className={r.violations ? 'h-full bg-warn' : 'h-full bg-good'} style={{ width: `${Math.max(r.violations ? 2 : 0, Math.min(100, r.pct * 100))}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2 className="mb-2 text-section">{t('etl.history')}</h2>
          {runs.isLoading && <Loading />}
          {runs.error && <ErrorState error={runs.error} retry={() => runs.refetch()} />}
          {runs.data && (runs.data.length ? (
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[420px] text-left text-label tnum">
                <thead className="sticky top-0 bg-surface text-muted"><tr><th className="py-1">#</th><th>{t('etl.col.step')}</th><th>{t('etl.col.start')}</th><th>{t('etl.col.inserted')}</th><th>{t('etl.col.rejected')}</th><th>{t('etl.col.duration')}</th><th>{t('etl.col.status')}</th></tr></thead>
                <tbody>{runs.data.map((r) => <tr key={r.id_run} className="border-t border-line"><td className="py-1">{r.id_run}</td><td>{r.paso}</td><td>{String(r.inicio).replace('T', ' ').slice(0, 19)}</td><td>{r.insertadas ?? '—'}</td><td>{r.rechazadas ?? '—'}</td><td>{dur(r.ms)}</td><td className={stepCls(r.estado)}>{r.estado}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <EmptyState title={t('etl.noHistory')} />)}
        </section>
      </div>
      <Lineage />
    </div>
  );
}
