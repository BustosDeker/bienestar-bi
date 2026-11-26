import { BadgeCheck, Download, Printer } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import DataTable from '../components/DataTable';
import { EmptyState, ErrorState, Loading, PageHeader, Warning, useTitle } from '../components/ui';
import { useMeta, useReport } from '../lib/hooks';
import { pivot, type Cell, type Model, type TRow } from '../lib/pivot';
import { downloadFile, estadoDe, toCSV } from '../lib/util';

type T = (k: string, o?: any) => string;
type U = Record<string, { umbral_bueno: number; umbral_regular: number }>;

const cell = (r: any, key: string, kpi: string | null, u: U, extra: Partial<Cell> = {}): Cell => ({
  v: r?.[key] ?? null, n: r?.n, sup: !!r?.suppressed, estado: kpi && r?.[key] != null ? estadoDe(r[key], u[kpi]) : null, ...extra,
});
const colName = (t: T, c: string) => t(`col.${c}`, { defaultValue: c });
const sexLabel = (t: T, s: string) => (s === 'F' ? t('common.female') : s === 'M' ? t('common.male') : s);

function buildModel(n: number, d: any, t: T, u: U): Model {
  const rows: any[] = d.rows;
  const lab = (k: string): string => t(`explorer.dim.${k}`, { defaultValue: colName(t, k) });
  if (n === 1) {
    const p = pivot(rows, ['Facultad', 'Escuela'], 'RangoEdad', { totalLabel: 'Total', nullColAsTotal: true });
    const cols = [...p.cols, '__total'];
    return {
      columns: [{ id: 'Facultad', header: lab('Facultad'), sticky: true }, { id: 'Escuela', header: lab('Escuela') }, ...cols.map((c) => ({ id: c, header: c === '__total' ? t('reports.total') : c, num: true })), { id: '__n', header: t('col.Estudiantes'), num: true }],
      rows: p.groups.map<TRow>((g) => {
        const sub = g.keys[1] === '(subtotal)' || g.keys[0] === 'TOTAL';
        const cells: Record<string, Cell> = {
          Facultad: { v: g.keys[0] === 'TOTAL' ? t('reports.total').toUpperCase() : g.keys[0], bold: sub },
          Escuela: { v: g.keys[0] === 'TOTAL' ? '' : g.keys[1] === '(subtotal)' ? t('reports.subtotal') : g.keys[1], bold: sub },
          __total: cell(g.total, 'valor', 'KPI-01', u, { bold: sub }),
          __n: { v: g.total?.n ?? null, int: true },
        };
        for (const c of p.cols) cells[c] = cell(g.cells[c], 'valor', 'KPI-01', u);
        return { id: g.keys.join('|'), cells, subtotal: sub };
      }),
    };
  }
  if (n === 2 || n === 3) {
    const rk = n === 2 ? ['TipoVinculo', 'Modalidad'] : ['TipoActividad'];
    const kpi = n === 2 ? 'KPI-02' : 'KPI-04';
    const p = pivot(rows, rk, 'RangoEdad', { totalLabel: 'Total', weighted: true });
    const out: TRow[] = p.groups.map((g) => {
      const cells: Record<string, Cell> = {};
      rk.forEach((k, i) => (cells[k] = { v: g.keys[i] }));
      for (const c of p.cols) cells[c] = cell(g.cells[c], 'valor', n === 3 && g.keys[0] === 'Actividad física' ? kpi : null, u);
      cells.__total = cell(g.total, 'valor', n === 3 && g.keys[0] === 'Actividad física' ? kpi : null, u, { bold: true });
      return { id: g.keys.join('|'), cells };
    });
    if (n === 2) {
      // fila de totales (suma de horas por rango de edad): esta si se compara con la meta de KPI-02
      const cells: Record<string, Cell> = { TipoVinculo: { v: t('reports.totalWeekly'), bold: true }, Modalidad: { v: '' } };
      let all = 0, w = 0;
      for (const c of p.cols) {
        const vals = p.groups.map((g) => g.cells[c]);
        const sup = vals.some((x) => x?.suppressed);
        const sum = vals.reduce((a, x) => a + (x?.valor ?? 0), 0);
        cells[c] = { v: sup ? null : sum, sup, estado: sup ? null : estadoDe(sum, u['KPI-02']), bold: true };
        if (!sup) { all += sum * (vals[0]?.n ?? 1); w += vals[0]?.n ?? 1; }
      }
      const tot = w ? all / w : null;
      cells.__total = { v: tot, estado: tot === null ? null : estadoDe(tot, u['KPI-02']), bold: true };
      out.push({ id: 'TOTAL', cells, subtotal: true });
    }
    return {
      columns: [...rk.map((k, i) => ({ id: k, header: lab(k), sticky: i === 0 })), ...p.cols.map((c) => ({ id: c, header: c, num: true })), { id: '__total', header: t('reports.total'), num: true }],
      rows: out,
    };
  }
  if (n === 4) {
    return {
      columns: ['OlaMedicion', 'valor', 'n', 'Variacion', 'Estado'].map((c) => ({ id: c, header: c === 'valor' ? 'SWLS' : c === 'n' ? t('col.Estudiantes') : colName(t, c), num: ['valor', 'n', 'Variacion'].includes(c), sticky: c === 'OlaMedicion' })),
      rows: rows.map((r) => ({
        id: String(r.OlaMedicion),
        cells: { OlaMedicion: { v: `${t('common.wave')} ${r.OlaMedicion}` }, valor: cell(r, 'valor', 'KPI-01', u), n: { v: r.n, int: true }, Variacion: { v: r.Variacion ?? null, sup: !!r.suppressed }, Estado: { v: r.Estado ? t(`estado.${r.Estado}`) : '—' } },
      })),
    };
  }
  if (n === 5) {
    const p = pivot(rows, ['Bloque', 'Grupo'], 'Sexo', { totalLabel: 'Total' });
    return {
      columns: [{ id: 'Bloque', header: lab('Bloque'), sticky: true }, { id: 'Grupo', header: lab('Grupo') }, ...p.cols.map((c) => ({ id: c, header: sexLabel(t, c), num: true }))],
      rows: p.groups.map((g) => {
        const isVal = g.keys[0].startsWith('Valoración');
        const cells: Record<string, Cell> = { Bloque: { v: isVal ? t('reports.blockRating') : t('reports.blockIntensity') }, Grupo: { v: g.keys[1] } };
        for (const c of p.cols) cells[c] = cell(g.cells[c], 'valor', isVal ? 'KPI-03' : null, u);
        return { id: g.keys.join('|'), cells };
      }),
    };
  }
  if (n === 6) {
    const m: Record<string, string> = { HorasPorEstudiante: 'KPI-02', Valoracion: 'KPI-03', DiasActividadFisica: 'KPI-04' };
    return {
      columns: ['Mes', 'Semana', 'InicioSemana', 'HorasPorEstudiante', 'Valoracion', 'DiasActividadFisica'].map((c) => ({ id: c, header: colName(t, c), num: c in m, sticky: c === 'Mes' })),
      rows: rows.map((r) => ({ id: r.InicioSemana, cells: { Mes: { v: r.Mes }, Semana: { v: `S${r.Semana}` }, InicioSemana: { v: r.InicioSemana }, ...Object.fromEntries(Object.entries(m).map(([k, kpi]) => [k, cell(r, k, kpi, u)])) } })),
    };
  }
  const p = pivot(rows, ['CicloEstudios'], 'RangoIngreso', { totalLabel: 'Total', weighted: true });
  return {
    columns: [{ id: 'CicloEstudios', header: lab('CicloEstudios'), sticky: true }, ...p.cols.map((c) => ({ id: c, header: c, num: true })), { id: '__total', header: t('reports.total'), num: true }],
    rows: p.groups.map((g) => {
      const cells: Record<string, Cell> = { CicloEstudios: { v: `${t('reports.cycle')} ${g.keys[0]}` } };
      for (const c of p.cols) cells[c] = cell(g.cells[c], 'valor', 'KPI-01', u);
      cells.__total = cell(g.total, 'valor', 'KPI-01', u, { bold: true });
      return { id: g.keys[0], cells };
    }),
  };
}

export default function Reports() {
  const { t } = useTranslation();
  useTitle(t('nav.reports'));
  const [sp, setSp] = useSearchParams();
  const n = Math.min(7, Math.max(1, Number(sp.get('r') ?? 1)));
  const { data: meta } = useMeta();
  const q = useReport(n);
  const u: U = useMemo(() => Object.fromEntries((meta?.kpis ?? []).map((k) => [k.id, k])), [meta]);
  const model = useMemo(() => (q.data && meta ? buildModel(n, q.data, t as T, u) : null), [q.data, meta, n, t, u]);
  const decimals = n === 4 || n === 6 ? 2 : n === 2 || n === 3 ? 2 : 1;

  const csv = () => {
    if (!model) return;
    const flat = model.rows.map((r) => Object.fromEntries(model.columns.map((c) => [c.header, r.cells[c.id]?.sup ? 'k' : r.cells[c.id]?.v ?? ''])));
    downloadFile(`R${n}_${t(`reports.r${n}.short`)}.csv`, toCSV(flat, model.columns.map((c) => c.header)));
  };

  return (
    <div>
      <PageHeader title={t('nav.reports')} subtitle={t('reports.subtitle')} actions={<>
        <button className="btn" onClick={csv} disabled={!model}><Download size={14} strokeWidth={1.5} /> CSV</button>
        <button className="btn" onClick={() => window.print()}><Printer size={14} strokeWidth={1.5} /> PDF</button>
      </>} />
      <div role="tablist" aria-label={t('nav.reports')} className="no-print -mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <button key={i} role="tab" aria-selected={n === i} onClick={() => setSp({ r: String(i) })} className={`btn shrink-0 ${n === i ? 'btn-primary' : ''}`}>R{i}<span className="hidden lg:inline"> · {t(`reports.r${i}.short`)}</span></button>
        ))}
      </div>
      <section className="card" aria-labelledby="rep-title">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="rep-title" className="text-section">R{n} · {t(`reports.r${n}.title`)}</h2>
            <p className="mt-1 text-label text-muted">{t(`reports.r${n}.desc`)}</p>
          </div>
          {q.data?.validated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-good/10 px-2 py-1 text-label font-medium text-good-t" title={t('reports.validatedHint')}><BadgeCheck size={14} aria-hidden /> {t('reports.validated')}</span>
          )}
        </div>
        {q.isLoading && <Loading rows={5} />}
        {q.error && <ErrorState error={q.error} retry={() => q.refetch()} />}
        {q.data && model && (model.rows.length ? <DataTable model={model} decimals={decimals} caption={t(`reports.r${n}.title`)} /> : <EmptyState title={t('common.noData')} hint={t('common.noDataHint')} />)}
      </section>
      <div className="mt-3"><Warning>{t('reports.legend')}</Warning></div>
    </div>
  );
}
