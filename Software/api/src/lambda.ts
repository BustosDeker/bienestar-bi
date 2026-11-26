// Adaptador de entrada para AWS Lambda (Function URL). La logica vive en app.ts.
import { handle } from 'hono/aws-lambda';
import { createApp } from './app.js';

export const handler = handle(createApp());
