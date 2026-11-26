# Guía de despliegue en AWS (nivel gratuito)

> **Estado:** el despliegue en AWS **no forma parte de este encargo y no se ejecutó ni se probó aquí**. Esta guía deja la aplicación lista para apuntar a RDS cambiando solo variables de entorno, y resume los pasos. Verifica precios y límites del nivel gratuito vigentes en la consola de AWS antes de crear recursos.

## Restricciones de costo
Un solo RDS. Nada de NAT Gateway, Multi-AZ, Aurora, QuickSight, OpenSearch, Elastic IP sin uso ni EC2 de más.

## 1. Base de datos (RDS for SQL Server Express)
1. Crea una instancia RDS SQL Server **Express**, clase `db.t3.micro`, sin Multi-AZ, con almacenamiento mínimo y acceso público restringido a tu IP (o dentro de una VPC con la Lambda).
2. Desde un cliente con `sqlcmd`, ejecuta en orden `Datos/01_oltp_create.sql`, `02_seed_oltp.sql`, `03_mart_create.sql`, `04_etl_procedures.sql`, `06_security.sql` (cambia antes las contraseñas) y `EXEC Mart_Bienestar.dbo.usp_ETL_Completo`.
3. En RDS no existe el login `sa`: usa el usuario maestro. Si el motor rechaza `CREATE DATABASE` con rutas por defecto, deja las rutas del servicio.

## 2. API
- Variables: `DB_HOST` (endpoint de RDS), `DB_PORT=1433`, `DB_ENCRYPT=true`, `DB_TRUST_CERT=false` (instala el certificado de RDS) o `true` en pruebas, `DB_API_*`, `DB_ETL_*`, `DB_LAB_*`, `CORS_ORIGINS` (URL de CloudFront), `AI_PROVIDER`.
- Guarda las credenciales en **SSM Parameter Store** (nivel estándar) o en variables cifradas de la función; nunca en el repositorio.
- **Lambda con Function URL**: empaqueta `api/` (`npm run build` genera `dist/`; el *handler* es `dist/src/lambda.handler`, adaptador `hono/aws-lambda`). Runtime Node.js 20. Requiere que la función alcance RDS (VPC con subredes públicas o RDS accesible; evita NAT Gateway).
- Alternativa más simple para una sustentación: ejecutar la API en tu equipo con `npm start` y la BD en RDS.

## 3. Web
`cd web && npm run build` y sube `dist/` a un bucket **S3** privado con **CloudFront** delante (acceso mediante OAC). Reglas de CloudFront:
- Comportamiento `/api/*` hacia la Function URL de la Lambda (sin caché), o define `VITE_API_PROXY` solo en desarrollo.
- Error 403/404 → `/index.html` con código 200 (rutas de la SPA).

## 4. IA con Bedrock (opcional)
Activa el acceso a un modelo económico en la región elegida, da a la función el permiso `bedrock:InvokeModel` sobre ese modelo y define `AI_PROVIDER=bedrock`, `AWS_REGION`, `BEDROCK_MODEL_ID`. Solo se envían valores agregados de KPI. Si Bedrock falla o excede el tiempo, la app usa `rules`.

## 5. Verificación
`GET /api/health`, `GET /api/kpis` y comparar un KPI con su consulta en `05_kpi_queries.sql`. Ejecuta `npm test` en `api/` apuntando a la BD de prueba (las pruebas de integración usan `sa`; en RDS créate un usuario equivalente para pruebas o sáltalas).
