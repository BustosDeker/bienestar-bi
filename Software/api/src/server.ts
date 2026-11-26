import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { config } from './config.js';

serve({ fetch: createApp().fetch, port: config.port }, (i) => console.log(`API Bienestar en http://localhost:${i.port}`));
