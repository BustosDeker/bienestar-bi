# API (contrato)

Base: `http://localhost:8787/api`. JSON en todas las respuestas. Errores: `{"error": "..."}` con 400 (validación, con `detalles`), 403 (rol), 404, 409 (duplicado), 422 (regla de negocio), 429 (límite de tasa) o 500.

**Autenticación:** todas las rutas, salvo `POST /api/auth/login` y `GET /api/health`, exigen la cookie de sesión `session` (httpOnly, SameSite=Strict) que entrega el login. Sin sesión: 401; con rol insuficiente: 403.

## Filtros comunes (query string)
`facultad`, `escuela`, `sexo` (F/M), `rangoEdad`, `ola` (1 a 3), `k` (1 a 50, por defecto 5). Los filtros viajan como **parámetros** SQL (nunca concatenados). Los grupos con menos de `k` estudiantes devuelven `valor: null` y `suppressed: true`.

| Método y ruta | Descripción |
|---|---|
| `GET /api/health` | Estado (público) |
| `POST /api/auth/login` | `{username, password}` → establece la cookie de sesión; `{username, rol, cod_estudiante}` (público; 10 intentos/min/IP) |
| `POST /api/auth/logout` · `GET /api/auth/me` | Cierra la sesión · devuelve la sesión actual |
| `GET /api/meta` | Catálogos, olas, jerarquías, medidas, dimensiones, umbrales (CONFIG_KPI) y estudiantes de demostración |
| `GET /api/kpis?filtros` | 4 KPI: `valor`, `n`, `estado`, `umbral`, `variacion`, `byOla`, `series` |
| `GET /api/reports/:n?filtros` | Reporte 1 a 7: `columns`, `rows`, `sql`, `ms`, `validated` |
| `POST /api/explore` | `{measure, rows[≤3], cols[≤2], filters, slicers{dim:[v]}, drill{dim:v}}` → filas por dimensión con `valor` y `n` |
| `GET /api/drivers?filtros` | Ranking de vínculos y actividades, matriz de Spearman, dispersión |
| `POST /api/log/survey` (**estudiante**) | `{fecha?, respuestas:[5 enteros 1..7]}`; el estudiante sale de la sesión; busca la ola por fecha (422 si no hay), 409 si ya existe |
| `POST /api/log/interaction` (**estudiante**) | `{id_vinculo, id_modalidad, fecha?, duracion_horas (0..24], valoracion 1..5}` |
| `POST /api/log/activity` (**estudiante**) | `{id_actividad, fecha?, duracion_min 1..600}` |
| `GET /api/me` (**estudiante**) | Encuestas, últimos registros, racha y valores personales del estudiante de la sesión |
| `POST /api/ai/recommend` | `{lang: es|en, kpis:[{id, valor, estado}]}` → 3 a 5 recomendaciones y `provider`/`fallback` |
| `POST /api/etl/run` (**bienestar**) | Ejecuta `usp_ETL_Dimensiones` y `usp_ETL_Hechos` |
| `GET /api/etl/runs?limit` | Historial de `AUDITORIA_ETL` |
| `GET /api/dq` | Reglas de calidad sobre el OLTP (9 reglas) |

Las vistas de grupo leen solo del Data Mart. Las escrituras van únicamente al OLTP (`ENCUESTA_BIENESTAR`, `RESPUESTA_SWLS`, `REGISTRO_INTERACCION`, `REGISTRO_ACTIVIDAD`).

Seguridad: CORS restringido a `CORS_ORIGINS` (con credenciales), cabeceras seguras (`secureHeaders`), límite de 240 solicitudes por minuto e IP, validación con `zod`.

## Permisos
- **Estudiante:** `/api/me`, `/api/log/*`, `/api/kpis` (agregados), `/api/meta`, `/api/ai/recommend`, `/api/auth/*`.
- **Bienestar:** todo lo demás (reportes, explorador, drivers, ETL, calidad, KPI, meta, IA), pero **no** `/api/me` ni `/api/log/*`.
