// Guarda respuestas reales de la API como JSON estatico para el modo demostracion del frontend.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COOKIE, createApp } from '../src/app.js';
import { signToken } from '../src/lib/auth.js';

const out = resolve(process.cwd(), '../web/public/demo');
mkdirSync(out, { recursive: true });
const app = createApp();
const save = async (path: string, file: string) => {
  const r = await app.request(path, { headers: { cookie: `${COOKIE}=${signToken({ sub: 'snapshot', rol: 'bienestar' }, 300)}` } });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  writeFileSync(resolve(out, file + '.json'), JSON.stringify(await r.json()));
  console.log('ok', file);
};
await save('/api/meta', 'meta');
await save('/api/kpis?k=5', 'kpis');
await save('/api/drivers?k=5', 'drivers');
await save('/api/etl/runs', 'etl-runs');
await save('/api/dq', 'dq');
for (let n = 1; n <= 7; n++) await save(`/api/reports/${n}?k=5`, `reports-${n}`);
process.exit(0);
