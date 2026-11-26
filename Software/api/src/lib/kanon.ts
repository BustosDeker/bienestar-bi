/** k-anonimato: oculta (valor = null, suppressed = true) las filas cuyo grupo tiene menos de k estudiantes. */
export function applyK<T extends Record<string, any>>(rows: T[], k: number, nField = 'n', valueFields: string[] = ['valor']): (T & { suppressed?: boolean })[] {
  return rows.map((r) => {
    const n = r[nField];
    if (typeof n === 'number' && n < k) {
      const c: any = { ...r, suppressed: true };
      for (const f of valueFields) c[f] = null;
      return c;
    }
    return r;
  });
}
