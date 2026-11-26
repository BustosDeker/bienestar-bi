import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';

const flat = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v ? flat(v, p + k + '.') : [p + k]));
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.tsx') || p.endsWith('.ts')) && !p.endsWith('.test.ts') ? [p] : []; });
// claves i18next con plurales: streak_one/streak_other -> streak
const has = (keys: Set<string>, k: string) => keys.has(k) || keys.has(k + '_one') || keys.has(k + '_other');

describe('i18n', () => {
  const esK = new Set(flat(es)), enK = new Set(flat(en));
  it('ES y EN tienen exactamente las mismas claves', () => {
    expect([...esK].filter((k) => !enK.has(k))).toEqual([]);
    expect([...enK].filter((k) => !esK.has(k))).toEqual([]);
  });
  it('todas las claves estáticas usadas en el código existen', () => {
    const missing: string[] = [];
    for (const f of walk('src')) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([A-Za-z0-9_.\-]+)'/g)) if (!has(esK, m[1])) missing.push(`${f}: ${m[1]}`);
      // claves con plantilla: t(`a.b.${x}`) -> se valida que el prefijo exista
      for (const m of src.matchAll(/\bt\(\s*`([A-Za-z0-9_.\-]+)\.\$\{/g)) if (![...esK].some((k) => k.startsWith(m[1] + '.'))) missing.push(`${f}: ${m[1]}.*`);
    }
    expect(missing).toEqual([]);
  });
});
