import { describe, expect, it } from 'vitest';
import { recommend } from '../src/ai/index.js';
import { rulesProvider } from '../src/ai/rules.js';
import { dimConds, filtersSchema } from '../src/lib/filters.js';
import { applyK } from '../src/lib/kanon.js';
import { kpiSql } from '../src/lib/kpi.js';
import { estado } from '../src/lib/semaforo.js';
import { spearman } from '../src/lib/stats.js';
import { allowed } from '../src/app.js';
import { hashPassword, signToken, verifyPassword, verifyToken } from '../src/lib/auth.js';

const u = { umbral_bueno: 26, umbral_regular: 20 };
describe('semáforo', () => {
  it('respeta los límites exactos', () => {
    expect(estado(26, u)).toBe('bueno');
    expect(estado(25.99, u)).toBe('regular');
    expect(estado(20, u)).toBe('regular');
    expect(estado(19.99, u)).toBe('malo');
    expect(estado(null, u)).toBeNull();
  });
  it('KPI-04 puede ser malo (< 1)', () => expect(estado(0.4, { umbral_bueno: 3, umbral_regular: 1 })).toBe('malo'));
});

describe('k-anonimato', () => {
  it('oculta grupos con n < k y conserva los demás', () => {
    const r = applyK([{ n: 4, valor: 3 }, { n: 5, valor: 4 }], 5);
    expect(r[0]).toMatchObject({ valor: null, suppressed: true });
    expect(r[1]).toMatchObject({ valor: 4 });
    expect(r[1].suppressed).toBeUndefined();
  });
});

describe('Spearman', () => {
  it('monótona creciente = 1, decreciente = -1, con empates', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 400])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 2, 2, 3], [1, 2, 2, 3])).toBeCloseTo(1);
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

describe('construcción de KPI', () => {
  const f = filtersSchema.parse({});
  it('KPI-01 promedia PuntajeSWLS', () => expect(kpiSql('KPI-01', f, 'none').sql).toContain('AVG(CAST(h.PuntajeSWLS AS FLOAT))'));
  it('KPI-02 y KPI-04 usan el calendario completo con ISNULL(...,0)', () => {
    for (const id of ['KPI-02', 'KPI-04'] as const) {
      const s = kpiSql(id, f, 'none').sql;
      expect(s).toContain('v_calendario');
      expect(s).toContain('ISNULL(w.x, 0)');
    }
  });
  it('KPI-04 cuenta fechas distintas solo de actividad física', () => {
    const s = kpiSql('KPI-04', f, 'none').sql;
    expect(s).toContain('COUNT(DISTINCT h.KeyTiempo)');
    expect(s).toContain('Actividad física');
  });
  it('los filtros viajan como parámetros, no concatenados', () => {
    const p: Record<string, any> = {};
    const c = dimConds(filtersSchema.parse({ escuela: "x'; DROP TABLE y;--", sexo: 'F' }), p);
    expect(c.join(' ')).not.toContain('DROP');
    expect(p.escuela).toContain('DROP');
  });
});

describe('motor de recomendaciones (rules)', () => {
  it('KPI-01 en rojo: la sugerencia de bienestar va primero', async () => {
    const r = await rulesProvider.recommend({
      lang: 'es',
      kpis: [
        { id: 'KPI-02', valor: 2, estado: 'malo' },
        { id: 'KPI-01', valor: 18, estado: 'malo' },
      ],
    });
    expect(r[0].kpi).toBe('KPI-01');
    expect(r[0].text).toMatch(/oficina de bienestar/i);
  });
  it('entrega entre 3 y 5 y respeta el idioma', async () => {
    const r = await recommend(
      {
        lang: 'en',
        kpis: [
          { id: 'KPI-01', valor: 24, estado: 'regular' },
          { id: 'KPI-02', valor: 7, estado: 'regular' },
          { id: 'KPI-03', valor: 4.2, estado: 'bueno' },
          { id: 'KPI-04', valor: 0.5, estado: 'malo' },
        ],
      },
      'rules',
    );
    expect(r.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(r.recommendations.length).toBeLessThanOrEqual(5);
    expect(r.recommendations[0].kpi).toBe('KPI-04');
    expect(r.recommendations[0].text).toMatch(/physical/i);
  });
  it('si bedrock falla cae a rules', async () => {
    const r = await recommend({ lang: 'es', kpis: [{ id: 'KPI-01', valor: 22, estado: 'regular' }] }, 'bedrock');
    expect(r.provider).toBe('rules');
    expect(r.fallback).toBe(true);
  });
});

describe('autenticación', () => {
  it('el token firmado se verifica y conserva rol y código', () => {
    const t = signToken({ sub: '202600002', rol: 'estudiante', cod: 202600002 });
    expect(verifyToken(t)).toMatchObject({ sub: '202600002', rol: 'estudiante', cod: 202600002 });
  });
  it('rechaza tokens alterados, vencidos o ajenos', () => {
    const t = signToken({ sub: 'x', rol: 'estudiante', cod: 1 });
    const [h, , sig] = t.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'x', rol: 'bienestar', exp: 9999999999 })).toString('base64url')}.${sig}`;
    expect(verifyToken(forged)).toBeNull();
    expect(verifyToken(signToken({ sub: 'x', rol: 'bienestar' }, -10))).toBeNull();
    expect(verifyToken('basura')).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
  });
  it('scrypt: la contraseña correcta valida y la incorrecta no', async () => {
    const h = await hashPassword('Clave#123');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('Clave#123', h)).toBe(true);
    expect(await verifyPassword('otra', h)).toBe(false);
  });
});

describe('permisos por rol', () => {
  it('el estudiante solo accede a lo suyo y a agregados anónimos', () => {
    expect(allowed('estudiante', 'GET', '/api/me')).toBe(true);
    expect(allowed('estudiante', 'POST', '/api/log/survey')).toBe(true);
    expect(allowed('estudiante', 'GET', '/api/kpis')).toBe(true);
    for (const [m, p] of [['GET', '/api/reports/1'], ['POST', '/api/explore'], ['GET', '/api/drivers'], ['POST', '/api/etl/run'], ['GET', '/api/etl/runs'], ['GET', '/api/dq']])
      expect(allowed('estudiante', m, p), `${m} ${p}`).toBe(false);
  });
  it('bienestar ve todo el panel pero no datos individuales ni escribe registros', () => {
    for (const [m, p] of [['GET', '/api/kpis'], ['GET', '/api/reports/3'], ['POST', '/api/explore'], ['GET', '/api/drivers'], ['POST', '/api/etl/run'], ['GET', '/api/dq']])
      expect(allowed('bienestar', m, p), `${m} ${p}`).toBe(true);
    for (const [m, p] of [['GET', '/api/me'], ['POST', '/api/log/survey'], ['POST', '/api/log/interaction'], ['POST', '/api/log/activity']])
      expect(allowed('bienestar', m, p), `${m} ${p}`).toBe(false);
  });
});
