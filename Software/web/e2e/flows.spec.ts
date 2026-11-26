import { expect, test } from '@playwright/test';
import { BIENESTAR, loginApi, loginStudentWithPendingWave, prepare } from './helpers';

test.beforeEach(async ({ page }) => { await prepare(page); });

test('sin sesión se redirige al ingreso; credenciales incorrectas muestran error', async ({ page }) => {
  await page.goto('/reportes');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Usuario').fill('bienestar');
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('alert')).toContainText(/incorrectos/);
  await expect(page).toHaveURL(/\/login$/);
});

test('Bienestar inicia sesión, ve solo sus módulos y puede cerrar sesión', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(BIENESTAR.user);
  await page.getByLabel('Contraseña', { exact: true }).fill(BIENESTAR.pass);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen ejecutivo' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  for (const n of ['Resumen', 'Reportes', 'Explorador', 'Drivers', 'Coach de IA', 'ETL y calidad']) await expect(nav.getByRole('link', { name: n })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Ajustes' })).toHaveCount(0);   // Ajustes vive en el menú del perfil
  await expect(nav.getByRole('link', { name: 'Mi bienestar' })).toHaveCount(0);
  await page.goto('/mi-bienestar');
  await expect(page.getByRole('heading', { name: 'Resumen ejecutivo' })).toBeVisible(); // redirigido a su inicio
  await page.getByTestId('user-menu').getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('el estudiante solo ve Mi bienestar (y Ajustes desde su menú)', async ({ page }) => {
  const cod = await loginStudentWithPendingWave(page);
  expect(cod).not.toBeNull();
  await page.goto('/');
  await expect(page).toHaveURL(/\/mi-bienestar$/);
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(nav.getByRole('link')).toHaveCount(1);
  await page.getByTestId('user-menu').getByRole('button').click();
  await expect(page.getByRole('menuitem', { name: 'Ajustes' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nav.getByRole('link', { name: 'Mi bienestar' })).toBeVisible();
  await expect(page.getByLabel('Facultad')).toHaveCount(0);   // sin filtros de gestión
  await page.goto('/reportes');
  await expect(page).toHaveURL(/\/mi-bienestar$/);
  expect((await page.request.get('/api/reports/1')).status()).toBe(403);
  expect((await page.request.post('/api/etl/run', { data: {} })).status()).toBe(403);
});

test('Bienestar no puede ver datos individuales por la API', async ({ page }) => {
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  expect((await page.request.get('/api/me')).status()).toBe(403);
  expect((await page.request.post('/api/log/survey', { data: { respuestas: [4, 4, 4, 4, 4] } })).status()).toBe(403);
});

test('registrar una encuesta SWLS (asistente de 5 pasos) como estudiante', async ({ page }) => {
  const cod = await loginStudentWithPendingWave(page);
  test.skip(!cod, 'Los 12 estudiantes de demostración ya respondieron todas las olas (reinicia con docker compose down -v)');
  await page.goto('/mi-bienestar');
  await page.getByRole('tab', { name: 'Encuesta SWLS' }).click();
  await expect(page.getByText('Pregunta 1 de 5')).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('slider').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(`Pregunta ${i + 1} de 5`)).toBeVisible();
    if (i < 4) await page.getByRole('button', { name: 'Siguiente' }).click();
  }
  await page.getByRole('button', { name: /Enviar encuesta/ }).click();
  await expect(page.getByText(/Encuesta registrada: \d+\/35/)).toBeVisible();
});

test('ejecutar el ETL desde la app y ver los pasos', async ({ page }) => {
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  await page.goto('/etl');
  await page.getByRole('button', { name: 'Ejecutar ETL' }).click();
  await expect(page.getByText('ETL completado')).toBeVisible();
  const table = page.getByRole('table').first();
  await expect(table).toContainText('Dimensiones');
  await expect(table).toContainText('Hechos');
  await expect(table).toContainText('OK');
});

test('el resumen muestra los 4 KPI con su semáforo y sin SQL', async ({ page }) => {
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  await page.goto('/');
  for (const id of ['KPI-01', 'KPI-02', 'KPI-03', 'KPI-04']) await expect(page.getByRole('heading', { name: new RegExp(id) })).toBeVisible();
  await expect(page.getByText(/Regular|Bueno|Malo/).first()).toBeVisible();
  await expect(page.getByText('Ver consulta SQL')).toHaveCount(0);
});

test('el menú del perfil ahorra espacio: Ajustes y Cerrar sesión solo aparecen al abrirlo', async ({ page }) => {
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  await page.getByTestId('user-menu').getByRole('button').click();
  await expect(page.getByRole('menuitem')).toHaveCount(2);
  await page.getByRole('menuitem', { name: 'Ajustes' }).click();
  await expect(page).toHaveURL(/\/ajustes$/);
  await expect(page.getByRole('heading', { name: 'Ajustes' }).first()).toBeVisible();
});

test('no hay tour de bienvenida', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('el buscador de la barra superior permite escribir y navegar', async ({ page }) => {
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  await page.goto('/');
  const search = page.getByRole('combobox', { name: 'Buscar' });
  await expect(page.getByText('Ctrl K')).toHaveCount(0);            // sin rótulo de atajo en el campo
  await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByText('Buscar')).toHaveCount(0); // ya no está en el menú lateral
  await search.click();
  await expect(page.getByRole('listbox')).toHaveCount(0);            // al enfocar no se despliega nada
  await search.pressSequentially('repor');
  const list = page.getByRole('listbox');
  await expect(list.getByRole('option')).toHaveCount(1);
  await expect(list.getByRole('option', { name: 'Reportes' })).toBeVisible();
  await expect(page.getByText('Modo presentación')).toHaveCount(0);
  await expect(page.getByText('Ir a', { exact: true })).toHaveCount(0);       // sin rótulos de grupo
  await expect(page.getByText('Acciones', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/reportes$/);
  await page.keyboard.press('Control+k');
  await expect(search).toBeFocused();
});

test('la barra superior no tapa los títulos', async ({ page }) => {
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  for (const url of ['/', '/reportes', '/drivers']) {
    await page.goto(url);
    const bar = await page.getByTestId('topbar').boundingBox();
    const h1 = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(bar && h1 && h1.y >= bar.y + bar.height - 1, `título bajo la barra en ${url}`).toBeTruthy();
  }
});

test('cambiar idioma y tema', async ({ page }) => {
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Resumen ejecutivo' })).toBeVisible();
  await page.keyboard.press('l');
  await expect(page.getByRole('heading', { name: 'Executive summary' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.keyboard.press('t');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('los 7 reportes cargan con insignia de validación', async ({ page }) => {
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  for (let n = 1; n <= 7; n++) {
    await page.goto(`/reportes?r=${n}`);
    await expect(page.getByText('Validado contra el diseño del informe')).toBeVisible();
    await expect(page.getByRole('table').first()).toBeVisible();
  }
});

test('explorador: segmentador y gráfico', async ({ page }) => {
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  await page.goto('/explorador');
  await expect(page.getByRole('img', { name: /Puntaje SWLS/ }).first()).toBeVisible();
  await page.getByLabel('Agregar segmentador').selectOption('Sexo');
  await page.getByRole('button', { name: 'Mujer' }).or(page.getByRole('button', { name: 'F', exact: true })).first().click();
  await expect(page.getByRole('img', { name: /Puntaje SWLS/ }).first()).toBeVisible();
});

test('el botón principal no se camufla al pasar el cursor', async ({ page }) => {
  await loginApi(page, BIENESTAR.user, BIENESTAR.pass);
  await page.goto('/coach');
  await expect(page.getByText('Regular').first()).toBeVisible();
  const b = page.getByRole('button', { name: 'Interpretar indicadores' });
  const bg = () => b.evaluate((e) => getComputedStyle(e).backgroundColor);
  const before = await bg();
  await b.hover();
  await page.waitForTimeout(300);
  expect(await bg()).toBe(before);
  expect(before).not.toBe(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
});
