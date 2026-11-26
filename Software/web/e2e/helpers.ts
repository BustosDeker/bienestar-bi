import { expect, type Page } from '@playwright/test';

export const BIENESTAR = { user: 'bienestar', pass: 'Bienestar2026!' };
export const STUDENT_PASS = 'Estudiante2026!';

/** Estado local: español y tema indicado. Debe llamarse antes de la primera navegación. */
export async function prepare(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((th) => {
    localStorage.setItem('bienestar-ui', JSON.stringify({ state: { lang: 'es', theme: th, k: 5 }, version: 0 }));
  }, theme);
}

/** Inicia sesión por API (la cookie httpOnly queda en el contexto del navegador). */
export async function loginApi(page: Page, user: string, pass: string) {
  const r = await page.request.post('/api/auth/login', { data: { username: user, password: pass } });
  expect(r.ok(), `login ${user}`).toBeTruthy();
}

/** Primer estudiante de demostración (202600001 a 202600012) con una ola pendiente. */
export async function loginStudentWithPendingWave(page: Page): Promise<string | null> {
  for (let i = 1; i <= 12; i++) {
    const cod = String(202600000 + i);
    await loginApi(page, cod, STUDENT_PASS);
    const me = await (await page.request.get('/api/me')).json();
    if (me.encuestas.length < 3) return cod;
  }
  return null;
}
