import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table';
import clsx from 'clsx';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, CircleAlert, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Cell, Model, TRow } from '../lib/pivot';
import { ESTADO_CLASS, fmt } from '../lib/util';

function CellView({ c, d, showState }: { c: Cell | undefined; d: number; showState: boolean }) {
  const { t } = useTranslation();
  if (!c) return <span className="text-muted">—</span>;
  if (c.sup) return <span className="inline-flex items-center gap-1 text-muted" title={t('privacy.suppressed')}><EyeOff size={12} aria-hidden /> <span className="sr-only">{t('privacy.suppressed')}</span>k</span>;
  if (c.v === null || c.v === undefined) return <span className="text-muted">—</span>;
  if (typeof c.v === 'string') return <span className={c.bold ? 'font-semibold' : ''}>{c.v}</span>;
  const e = c.estado;
  const Icon = e === 'bueno' ? CheckCircle2 : e === 'regular' ? CircleAlert : AlertTriangle;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded px-1.5 py-0.5', showState && e && ESTADO_CLASS[e].bg, showState && e && ESTADO_CLASS[e].text, c.bold && 'font-semibold')}>
      {fmt(c.v, c.int ? 0 : d)}
      {showState && e && <><Icon size={12} aria-hidden /><span className="sr-only">{t(`estado.${e}`)}</span></>}
    </span>
  );
}

/** Tabla ordenable con columna fija, subtotales y resaltado de filas/semaforo. */
export default function DataTable({ model, decimals = 2, showState = true, caption }: { model: Model; decimals?: number; showState?: boolean; caption: string }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [hl, setHl] = useState<Set<string>>(new Set());
  const columns = useMemo<ColumnDef<TRow>[]>(
    () => model.columns.map((c) => ({
      id: c.id,
      header: c.header,
      accessorFn: (r: TRow) => { const v = r.cells[c.id]?.v; return v === undefined ? null : v; },
      sortingFn: (a, b, id) => { const x = a.getValue<any>(id), y = b.getValue<any>(id); if (x === y) return 0; if (x === null) return -1; if (y === null) return 1; return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); },
      meta: c,
      cell: ({ row }) => <CellView c={row.original.cells[c.id]} d={decimals} showState={showState} />,
    })),
    [model.columns, decimals, showState],
  );
  const table = useReactTable({ data: model.rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), enableSortingRemoval: true });
  return (
    <div className="max-w-full overflow-auto rounded-card border border-line [contain:paint]">
      <table className="w-full min-w-[560px] border-collapse text-left tnum">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-bg">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const m = h.column.columnDef.meta as { num?: boolean; sticky?: boolean };
                const s = h.column.getIsSorted();
                return (
                  <th key={h.id} scope="col" aria-sort={s === 'asc' ? 'ascending' : s === 'desc' ? 'descending' : 'none'} className={clsx('border-b border-line px-3 py-2 text-label font-medium text-muted', m.num && 'text-right', m.sticky && 'sticky-col !bg-bg')}>
                    <button className={clsx('inline-flex min-h-[28px] items-center gap-1 hover:text-fg', m.num && 'flex-row-reverse')} onClick={h.column.getToggleSortingHandler()}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {s === 'asc' ? <ArrowUp size={12} aria-hidden /> : s === 'desc' ? <ArrowDown size={12} aria-hidden /> : <ArrowUpDown size={12} className="opacity-40" aria-hidden />}
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} onClick={() => setHl((p) => { const n = new Set(p); n.has(r.original.id) ? n.delete(r.original.id) : n.add(r.original.id); return n; })}
              className={clsx('cursor-pointer border-b border-line/60 hover:bg-bg', r.original.subtotal && 'bg-bg font-semibold', hl.has(r.original.id) && '!bg-accent/10 outline outline-1 -outline-offset-1 outline-accent')}>
              {r.getVisibleCells().map((c) => {
                const m = c.column.columnDef.meta as { num?: boolean; sticky?: boolean };
                return <td key={c.id} className={clsx('px-3 py-2', m.num && 'text-right', m.sticky && 'sticky-col', r.original.subtotal && m.sticky && '!bg-bg')}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
