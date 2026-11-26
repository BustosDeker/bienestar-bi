import 'dotenv/config';

const env = process.env;
export const config = {
  port: Number(env.API_PORT ?? 8787),
  db: {
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 14330),
    encrypt: (env.DB_ENCRYPT ?? 'false') === 'true',
    trustCert: (env.DB_TRUST_CERT ?? 'true') === 'true',
    api: { user: env.DB_API_USER ?? 'bienestar_api', password: env.DB_API_PASSWORD ?? 'Api#Bienestar2026' },
    etl: { user: env.DB_ETL_USER ?? 'bienestar_etl', password: env.DB_ETL_PASSWORD ?? 'Etl#Bienestar2026' },
    oltpName: env.DB_OLTP_NAME ?? 'BienestarOLTP',
    martName: env.DB_MART_NAME ?? 'Mart_Bienestar',
  },
  corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173').split(',').map((s) => s.trim()),
  auth: {
    secret: env.AUTH_SECRET ?? (env.NODE_ENV === 'production' ? '' : 'dev-secret-cambiar-en-produccion-0123456789'),
    ttlSec: Number(env.AUTH_TTL_SEC ?? 8 * 3600),
    cookieSecure: (env.AUTH_COOKIE_SECURE ?? (env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true',
  },
  rateLimitPerMin: Number(env.RATE_LIMIT_PER_MIN ?? 240),
  loginLimitPerMin: Number(env.LOGIN_LIMIT_PER_MIN ?? 10),
  ai: {
    provider: (env.AI_PROVIDER ?? 'rules') as 'rules' | 'bedrock',
    region: env.AWS_REGION ?? 'us-east-1',
    modelId: env.BEDROCK_MODEL_ID ?? '',
    timeoutMs: Number(env.AI_TIMEOUT_MS ?? 8000),
    retries: Number(env.AI_RETRIES ?? 1),
  },
};

if (!config.auth.secret || config.auth.secret.length < 16) throw new Error('AUTH_SECRET es obligatorio (mínimo 16 caracteres) en producción');
