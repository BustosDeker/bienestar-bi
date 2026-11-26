import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { BIENESTAR, loginApi, loginStudentWithPendingWave, prepare } from './helpers';

const OUT = resolve(process.cwd(), '../docs/capturas');
mkdirSync(OUT, { recursive: true });

type Who = 'bienestar' | 'estudiante' | 'anon';
const PAGES: { name: string; url: string; who: Who; ready: (p: Page) => Promise<void> }[] = [
  { name: '00-login', url: '/login', who: 'anon', ready: async (p) => { await expect(p.getByRole('button', { name: 'Ingresar' })).toBeVisible(); } },
  { name: '01-resumen', url: '/', who: 'bienestar', ready: async (p) => { await expect(p.getByRole('heading', { name: /KPI-04/ })).toBeVisible(); await expect(p.getByRole('img', { name: /mapa de calor|Heat map/i }).first()).toBeVisible(); } },
  { name: '02-reporte-r1', url: '/reportes?r=1', who: 'bienestar', ready: async (p) => { await expect(p.getByRole('table').first()).toBeVisible(); } },
  { name: '03-reporte-r4', url: '/reportes?r=4', who: 'bienestar', ready: async (p) => { await expect(p.getByRole('table').first()).toBeVisible(); } },
  { name: '04-reporte-r6', url: '/reportes?r=6', who: 'bienestar', ready: async (p) => { await expect(p.getByRole('table').first()).toBeVisible(); } },
  { name: '05-explorador', url: '/explorador', who: 'bienestar', ready: async (p) => { await expect(p.getByRole('img', { name: /Puntaje SWLS/ }).first()).toBeVisible(); } },
  { name: '06-drivers', url: '/drivers', who: 'bienestar', ready: async (p) => { await expect(p.getByRole('img', { name: /Matriz|matrix/i }).first()).toBeVisible(); } },
  { name: '07-mi-bienestar', url: '/mi-bienestar', who: 'estudiante', ready: async (p) => { await expect(p.getByRole('img', { name: /perfil|profile/i }).first()).toBeVisible(); } },
  { name: '08-coach', url: '/coach', who: 'bienestar', ready: async (p) => { await expect(p.getByText('Regular').first()).toBeVisible(); await p.getByRole('button', { name: /Interpretar|Interpret/ }).click(); await expect(p.getByText(/Fuente|Source/)).toBeVisible(); } },
  { name: '09-etl', url: '/etl', who: 'bienestar', ready: async (p) => { await expect(p.getByText(/DQ-01/)).toBeVisible(); await expect(p.getByRole('img', { name: /Linaje|Lineage/ }).first()).toBeVisible(); } },
  { name: '11-menu-perfil', url: '/', who: 'bienestar', ready: async (p) => { await expect(p.getByRole('heading', { name: /KPI-04/ })).toBeVisible(); await p.getByTestId('user-menu').getByRole('button').click(); await expect(p.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeVisible(); } },
  { name: '10-ajustes', url: '/ajustes', who: 'bienestar', ready: async (p) => { await expect(p.getByRole('heading', { name: /Ajustes|Settings/ }).first()).toBeVisible(); } },
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`capturas ${theme}`, () => {
    for (const pg of PAGES) {
      test(`${pg.name}`, async ({ page }, info) => {
        await prepare(page, theme);
        if (pg.who === 'bienestar') await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
        if (pg.who === 'estudiante') await loginStudentWithPendingWave(page);
        await page.goto(pg.url);
        await pg.ready(page);
        await page.waitForTimeout(900);
        await page.screenshot({ path: resolve(OUT, `${pg.name}-${info.project.name}-${theme}.png`), fullPage: true });
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, 'desborde horizontal de la página').toBeLessThanOrEqual(1);
      });
    }
  });
}
