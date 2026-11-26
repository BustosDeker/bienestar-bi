# Manual técnico

## Arquitectura

```
Navegador / PWA (React) ──/api──▶ API (Hono + mssql) ──▶ SQL Server
                                    │                     ├─ BienestarOLTP  (18 tablas, escritura de Mi bienestar)
                                    │                     └─ Mart_Bienestar (estrella: 5 dimensiones, 3 hechos, vistas)
                                    └─▶ IA: rules (local) | Amazon Bedrock (opcional, solo agregados)
```

- **OLTP → Data Mart** mediante vistas `v_datos*` y procedimientos `usp_ETL_Dimensiones` y `usp_ETL_Hechos` (`MERGE` en dimensiones; recarga completa idempotente de los hechos, dentro de una transacción y con registro en `AUDITORIA_ETL`).
- La API se separa en adaptador de entrada (`server.ts` para Node, `lambda.ts` para AWS Lambda) y la lógica en `app.ts` y `lib/*`.
- El frontend usa React 18, Vite, Tailwind (tokens de diseño en `index.css`), TanStack Query/Table, Zustand, react-i18next, framer-motion, cmdk, Radix y Apache ECharts.

## Modelo de datos y correcciones aplicadas al script base

1. `DimTiempo` incluye `Semana` (ISO) e `InicioSemana` (lunes) y se carga con el **calendario completo** de los periodos con olas.
2. `DiasActividad` es **no aditiva**: KPI-04 usa `COUNT(DISTINCT KeyTiempo)` por estudiante y semana, solo `TipoActividad = 'Actividad física'`.
3. `v_datosEstudiante` toma la **matrícula más reciente** (`OUTER APPLY ... TOP 1`), una fila por estudiante.
4. El rango de edad se calcula a una **fecha fija** (inicio del periodo de la matrícula), no con `GETDATE()`.
5. KPI-02 y KPI-04 promedian sobre el calendario **estudiante × semana** (`v_calendario`), con 0 donde no hubo registros; así «Malo» es alcanzable.
6. `Sexo` es `CHAR(1)` y se muestra como Mujer/Hombre en la interfaz.
7. ETL idempotente con transacción y auditoría. Los rechazos (encuestas incompletas o fuera de ola, actividades < 10 min) se cuentan en `AUDITORIA_ETL.rechazadas`.

Vistas añadidas en el Mart: `v_estudiante_programa` (programa por estudiante), `v_semana_ola` (ola a la que pertenece cada semana) y `v_calendario`.

### Definición de las medidas (nombres idénticos al informe)
- `PuntajeSWLS` = suma de 5 ítems (5 a 35). `VariacionPuntajeSWLS` = ola actual − anterior con `LAG()`, no se almacena.
- `HorasSignificativas` = suma de horas con valoración ≥ 4. `ValoracionInteraccion` = promedio 1 a 5 (promedio de promedios por estudiante, día y tipo; no se pondera por n de registros).
- `DiasActividad` = fechas distintas con ≥ 10 min. `MinutosActividad` = suma de minutos (solo registros ≥ 10 min).
- Umbrales del semáforo en la tabla `CONFIG_KPI` del OLTP (la API los lee y los cachea 60 s).

## Autenticación y autorización
- **Cuentas:** tabla `USUARIO` del OLTP (rol `estudiante` o `bienestar`; los estudiantes llevan su `cod_estudiante`). Contraseñas con **scrypt** (N=16384, r=8, p=1, sal aleatoria de 16 bytes) y comparación en tiempo constante; si el usuario no existe se verifica contra un hash ficticio para no filtrar su existencia por tiempos.
- **Sesión:** JWT HS256 firmado con `AUTH_SECRET` en una cookie `httpOnly`, `SameSite=Strict` (y `Secure` en producción) de 8 h. Mitiga el robo por XSS y el CSRF. La web y la API deben servirse bajo el mismo origen (el proxy de Vite en desarrollo; CloudFront en AWS).
- **Autorización en la API (por rol y ruta):** Estudiante solo `GET /api/me`, `POST /api/log/*` (siempre con el código de su sesión, nunca el del cuerpo), `GET /api/kpis` (agregados con k-anonimato), `GET /api/meta` y el coach. Bienestar accede a todo el panel pero **no** a `/api/me` ni a `/api/log/*`: no ve datos individuales ni escribe registros. La web además oculta lo no permitido y redirige.
- **Fuerza bruta:** 10 intentos de ingreso por IP y minuto (`LOGIN_LIMIT_PER_MIN`).

## Seguridad y privacidad

| Capa | Medida |
|---|---|
| Datos | Códigos de estudiante seudonimizados; sin datos personales en logs ni en la IA (solo `id`, `valor`, `estado` de cada KPI). |
| SQL | Consultas parametrizadas; entradas validadas con `zod`; `bienestar_api` solo `SELECT` + `INSERT` en las 4 tablas de registro del OLTP; `bienestar_etl` solo para el ETL. |
| Web/API | CORS restringido, cabeceras seguras, límite de tasa, sesión con JWT en cookie httpOnly. |
| Privacidad | k-anonimato en servidor: los grupos con n < k devuelven `valor = null` y se señalizan. |

### Riesgos y límites (a declarar en la sustentación)
- Los estudios base son **correlacionales** y parte de ellos incluye adultos mayores: no se extrapolan. Ninguna vista afirma causalidad.
- Los datos son **sintéticos**; las cifras demuestran el diseño, no la realidad de la universidad.
- La autenticación es propia y sencilla (usuario y contraseña con scrypt + JWT). No hay recuperación de contraseña, bloqueo de cuentas ni doble factor; en producción convendría Amazon Cognito u otro proveedor. Las contraseñas de demostración están en el README y deben cambiarse.
- k-anonimato no impide la inferencia por diferencias entre filtros sucesivos.
- La IA solo interpreta agregados; con Bedrock el texto es generado y podría contener imprecisiones, por eso se fuerza la sugerencia de bienestar si KPI-01 está en rojo y se cae a `rules` si falla.

## Pruebas
- **API**: unitarias (semáforo, k-anonimato, Spearman, construcción del SQL de cada KPI, motor `rules`, JWT, scrypt, matriz de permisos por rol) e integración contra la BD de Docker (cada KPI coincide con la consulta directa, 7 reportes, login, cookie httpOnly, 401/403 por rol, ETL idempotente, validación de la encuesta).
- **Web**: Vitest verifica paridad ES/EN y que toda clave usada exista; **E2E Playwright**: ingreso con error, módulos por rol y cierre de sesión, estudiante restringido, registrar encuesta, ejecutar ETL, KPI, buscador, idioma y tema, 7 reportes, explorador y contraste del botón principal; más generación de capturas y verificación de que no hay desborde horizontal en 1440 px y 390 px.

## Rendimiento
Las consultas de KPI y reportes responden en decenas a pocos cientos de ms sobre ~50 000 filas de hechos. ECharts se carga de forma diferida en un chunk aparte (640 kB, 213 kB gzip), las páginas se cargan bajo demanda y la PWA precachea los activos.

**Lighthouse** (build de producción local, Chromium de Playwright, página Resumen):

| Perfil | Rendimiento | Accesibilidad |
|---|---|---|
| Escritorio | **97** | **100** |
| Móvil (CPU 4× más lenta y red 4G simulada) | 54 a 59 | **100** |

El objetivo de ≥ 90 se cumple en escritorio y en accesibilidad; **en móvil con estrangulamiento no se alcanza** (TBT ≈ 1–1,7 s por el peso de React + ECharts). Mejoras posibles: sustituir ECharts por una versión más ligera de los gráficos del Resumen, servir con compresión Brotli y CDN (CloudFront ya lo haría) y precargar el chunk. La medición en una distribución real con CloudFront será mejor que la de `vite preview`.

## Límites conocidos
- `Mi bienestar` lee el radar desde el Mart, por lo que cambia tras ejecutar el ETL; la línea de tiempo y los registros se leen del OLTP y cambian al instante.
- Con `AI_PROVIDER=bedrock` se requiere acceso al modelo en la cuenta de AWS; no se probó contra AWS en este entorno.
