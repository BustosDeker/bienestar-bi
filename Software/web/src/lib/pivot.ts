import type { Estado } from './util';

export interface Cell { v: number | string | null; n?: number; sup?: boolean; estado?: Estado; bold?: boolean; int?: boolean }
export interface TRow { id: string; cells: Record<string, Cell>; subtotal?: boolean }
export interface TCol { id: string; header: string; num?: boolean; sticky?: boolean }
export interface Model { columns: TCol[]; rows: TRow[] }

type Row = Record<string, any>;

/** Pivote simple: filas por `rowKeys`, columnas por `colKey`; el total de fila es promedio ponderado por n. */
export function pivot(rows: Row[], rowKeys: string[], colKey: string, opts: { totalLabel: string; nullColAsTotal?: boolean; weighted?: boolean; value?: string }): { cols: string[]; groups: { keys: string[]; cells: Record<string, Row>; total?: Row }[] } {
  const value = opts.value ?? 'valor';
  const cols: string[] = [];
  const map = new Map<string, { keys: string[]; cells: Record<string, Row>; total?: Row }>();
  for (const r of rows) {
    const id = rowKeys.map((k) => r[k]).join('¦');
    let g = map.get(id);
    if (!g) { g = { keys: rowKeys.map((k) => String(r[k])), cells: {} }; map.set(id, g); }
    const c = r[colKey];
    if (c === null && opts.nullColAsTotal) { g.total = r; continue; }
    const col = String(c);
    if (!cols.includes(col)) cols.push(col);
    g.cells[col] = r;
  }
  if (opts.weighted) {
    for (const g of map.values()) {
      if (g.total) continue;
      let s = 0, w = 0, sup = false;
      for (const c of Object.values(g.cells)) { if (c[value] === null || c[value] === undefined) { sup = true; continue; } s += c[value] * c.n; w += c.n; }
      g.total = { [value]: w ? s / w : null, n: w, suppressed: sup && !w };
    }
  }
  return { cols: cols.sort(), groups: [...map.values()] };
}
