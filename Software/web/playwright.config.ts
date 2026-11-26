import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, testMatch: /capturas\.spec\.ts/ },
  ],
  // Requiere la BD en Docker (docker compose up). Levanta la API y la web ya compilada.
  webServer: [
    { command: 'npm start', cwd: '../api', url: 'http://localhost:8787/api/health', reuseExistingServer: true, timeout: 60_000, env: { LOGIN_LIMIT_PER_MIN: '1000', RATE_LIMIT_PER_MIN: '5000' } },
    { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 },
  ],
});
