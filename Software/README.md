# Bienestar BI · G3 (Unidad 3, Inteligencia de Negocios)

Aplicación web y móvil (PWA) de BI para el seguimiento del **bienestar subjetivo de estudiantes universitarios**. Cuatro KPI con semáforo, siete reportes de gestión, explorador analítico propio, módulo de estudiante que escribe en el OLTP, coach de IA interpretativo y centro de ETL y calidad.

- **Sin** Power BI, Qlik ni Tableau: todos los visualizadores son componentes propios (React + Apache ECharts).
- La IA solo **interpreta** valores agregados de los KPI. No se entrena ningún modelo.
- Plataforma asignada: **AWS** (RDS for SQL Server Express, Lambda, S3/CloudFront, Bedrock opcional). En desarrollo todo corre en local con Docker; ver [docs/despliegue.md](docs/despliegue.md).

## Instalación en 10 minutos

Requisitos: Docker Desktop, Node.js 20 o superior y Python 3 (solo para regenerar los datos sintéticos).

```bash
# 1) Base de datos: SQL Server + scripts de Datos/ + ETL inicial (la primera vez descarga ~1,5 GB)
cd Software/infra
cp .env.example .env            # en Windows: copy .env.example .env
docker compose up -d            # espera a que el contenedor bienestar-init termine ("Listo.")

# 2) API (puerto 8787)
cd ../api
cp .env.example .env
npm install
npm run dev

# 3) Web (puerto 5173)
cd ../web
npm install
npm run dev                     # http://localhost:5173
```

Producción local: `npm run build && npm run preview` en `web/` (puerto 4173, con proxy a la API).

> **Puerto de SQL Server:** el contenedor se publica en `localhost:14330` (no en 1433) para no chocar con un SQL Server instalado en Windows. Cámbialo con `DB_PORT` en `.env`.

Reiniciar los datos desde cero: `docker compose down -v && docker compose up -d`.

## Acceso (inicio de sesión y roles)

La app exige iniciar sesión. Hay **dos roles** y cada uno ve solo los módulos que necesita (la API también lo impone):

| Rol | Usuario | Contraseña (demostración) | Módulos |
|---|---|---|---|
| **Bienestar** | `bienestar` | `Bienestar2026!` | Resumen, Reportes, Explorador, Drivers, Coach de IA, ETL y calidad. No ve datos individuales. |
| **Estudiante** | su código, p. ej. `202600002` (hay 360 cuentas: `202600001` a `202600360`) | `Estudiante2026!` | Mi bienestar. Solo ve y escribe sus propios datos. |

**Ajustes** y **Cerrar sesión** están en el menú del perfil (clic en el nombre, arriba a la derecha).

Los estudiantes `202600001` a `202600012` tienen la ola 3 pendiente, para poder registrar una encuesta en la demostración. Las contraseñas se guardan como hash **scrypt** en la tabla `USUARIO` y la sesión viaja en una cookie `httpOnly` `SameSite=Strict`. **Estas credenciales son solo de demostración:** cambia las contraseñas y `AUTH_SECRET` antes de desplegar, y oculta la ayuda de la pantalla de ingreso con `VITE_DEMO_HINT=false` al compilar la web.

## Variables de entorno (`.env.example`)

| Variable | Para qué | Valor local |
|---|---|---|
| `DB_HOST`, `DB_PORT` | Servidor SQL | `localhost`, `14330` |
| `DB_ENCRYPT`, `DB_TRUST_CERT` | TLS (poner `true`/`false` según RDS) | `false`, `true` |
| `DB_SA_PASSWORD` | Solo Docker y pruebas | `Bienestar#2026` |
| `DB_API_USER/PASSWORD` | Usuario de la API (lectura del Mart, escritura solo en tablas de registro del OLTP) | `bienestar_api` |
| `DB_ETL_USER/PASSWORD` | Usuario del ETL | `bienestar_etl` |
| `AUTH_SECRET` | Clave para firmar la sesión (JWT HS256). **Obligatoria en producción**, mínimo 16 caracteres | valor de desarrollo |
| `AUTH_TTL_SEC`, `AUTH_COOKIE_SECURE` | Duración de la sesión (8 h) y cookie solo HTTPS | `28800`, `false` |
| `LOGIN_LIMIT_PER_MIN` | Intentos de inicio de sesión por IP y minuto | `10` |
| `AI_PROVIDER` | `rules` (por defecto, sin internet) o `bedrock` | `rules` |
| `AWS_REGION`, `BEDROCK_MODEL_ID` | Solo con `bedrock` | — |
| `CORS_ORIGINS` | Orígenes permitidos | `localhost:5173,4173` |

> Las contraseñas con `#` van entre comillas en los `.env`. **Cambia todas las contraseñas** antes de desplegar; las del repositorio son solo para desarrollo local.

Para apuntar a **RDS** basta cambiar `DB_HOST`, `DB_PORT`, `DB_ENCRYPT` y las contraseñas; no se toca código.

## Comandos

| Dónde | Comando | Qué hace |
|---|---|---|
| `infra/` | `docker compose up -d` | Levanta SQL Server y carga `Datos/01..06` + ETL |
| `api/` | `npm run dev` · `npm test` · `npm run typecheck` | API con recarga, pruebas unitarias y de integración con la BD, tipado |
| `api/` | `npm run snapshot` | Regenera los JSON de `web/public/demo` (modo demostración) |
| `web/` | `npm run dev` · `npm run build` | Servidor de desarrollo · build con PWA |
| `web/` | `npm test` | Pruebas Vitest (paridad ES/EN y claves de traducción) |
| `web/` | `npm run e2e` | Pruebas E2E Playwright (requiere BD y `npm run build`) |
| `web/` | `npm run capturas` | Genera las capturas en `docs/capturas/` |
| `Datos/` | `python 02_seed_oltp.py` | Regenera `02_seed_oltp.sql` (semilla fija) |

## Estructura (mapea a los entregables)

```
bienestar-bi/
├─ Datos/        01_oltp_create · 02_seed_oltp (.py/.sql) · 03_mart_create · 04_etl_procedures · 04b_etl_app · 05_kpi_queries · 06_security
├─ Software/
│  ├─ web/       React + Vite + TypeScript (PWA)
│  ├─ api/       Hono + mssql + JWT (servidor local y adaptador Lambda en src/lambda.ts)
│  ├─ infra/     docker-compose.yml, init-db.sh, .env.example
│  └─ docs/      manual_usuario · manual_tecnico · api · despliegue · decisiones · capturas/
└─ Videos/       guion_general.md (10 min) · guion_ejecutivo.md (3 min)
```

## Módulos

La app solo muestra información (como un panel de BI). La demostración de que los indicadores salen de consultas a la base se hace ejecutando `Datos/05_kpi_queries.sql` en SSMS y comparando con lo que muestra la app.


1. **Resumen**: 4 KPI con semáforo, sparkline y variación; evolución por ola, hallazgos automáticos, mapa de calor escuela × ola, recomendaciones de IA.
2. **Reportes R1 a R7**: con subtotales, promedios ponderados, semáforo, exportación CSV/PDF e insignia de validación de estructura.
3. **Explorador**: medida, arrastrar dimensiones, 4 tipos de vista, drill-down/up (Facultad→Escuela; Año→Mes→Semana→Día), segmentadores, filtro cruzado, vistas guardadas y enlaces compartibles.
4. **Drivers**: ranking de vínculos y actividades, matriz de Spearman, dispersión. Descriptivo, con advertencia de causalidad.
5. **Mi bienestar**: encuesta SWLS de 5 pasos, registro de interacción y de actividad (escriben en el OLTP), radar, línea de tiempo, racha, coach personal.
6. **Coach de IA**: `rules` (determinista) o `bedrock`, con caída automática a `rules`.
7. **ETL y calidad**: ejecución por pasos, auditoría, 9 reglas de calidad, linaje interactivo.
8. **Ajustes**: idioma, tema, acento, densidad, privacidad k, cuenta y cierre de sesión.

Extras: k-anonimato, buscador escribible en la barra superior, exportar a PDF (imprimir), PWA instalable, modo demostración con JSON estático si la API no responde, accesibilidad AA (foco visible, ARIA, tabla alternativa en cada gráfico) y `prefers-reduced-motion`.

## Solución de problemas

- *«No se pudo conectar con la API»*: revisa que `npm run dev` esté en `api/` y que Docker esté levantado; la web entra en modo demostración (aviso amarillo) con datos guardados.
- *«Error de inicio de sesión»*: contraseñas con `#` sin comillas en `.env`, o un SQL Server local escuchando el mismo puerto.
- *«Ya respondiste todas las olas»*: entra con otro estudiante de demostración (`202600001` a `202600012`) o reinicia con `docker compose down -v`.
