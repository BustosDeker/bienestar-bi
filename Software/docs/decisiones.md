# Decisiones que se apartan del prompt (o lo precisan)

| # | Decisión | Razón |
|---|---|---|
| 1 | Usuario extra `bienestar_etl` (db_owner en el Mart, lectura en el OLTP). | El ETL escribe en el Mart y lee el OLTP; no cabe en los mínimos privilegios de `bienestar_api`. |
| 2 | "Semana observada" = semana (`InicioSemana`) con al menos un registro de interacción o actividad; el calendario de KPI-02/04 es DimEstudiante × semanas observadas. | Evita deflactar los promedios con semanas en que el sistema aún no tenía datos (p. ej. fin del periodo) y mantiene alcanzable el estado "Malo". |
| 3 | `DimTiempo` se carga con el calendario completo de los periodos con olas (no solo fechas con datos). | Permite contar semanas/días con 0 actividad. |
| 4 | Encuestas fuera de ola o incompletas se rechazan en `usp_ETL_Hechos`; actividades < 10 min se descartan y se cuentan como rechazadas. | Reglas de calidad del informe. |
| 5 | KPI-03 es promedio de promedios por (estudiante, día, tipo), sin ponderar por n° de registros. | No se agrega columna al hecho para respetar los nombres del informe. |
| 6 | Imagen `mssql/server` también usada para el contenedor de inicialización. | El `sqlcmd` de `mssql-tools` no soporta `-f 65001` (tildes). |
| 7 | Seed solo con la matrícula 2026-II (un periodo). | Un único periodo con olas definido en el informe. |
| 8 | SQL Server en Docker publicado en el puerto **14330** (no 1433). | En el equipo de desarrollo ya había un SQL Server de Windows escuchando 1433 y interceptaba la conexión. |
| 9 | Las contraseñas con `#` van entre comillas en los `.env`. | `dotenv` trata `#` como comentario y truncaba la contraseña. |
| 10 | Accent teal con dos tonos: `#0F9D8A` para gráficos y rellenos, `#0B7A6B` (`--accent-strong`) para texto y botones en modo claro; igual con los textos del semáforo (`--good-text`, etc.). | `#0F9D8A` sobre blanco da ~3,5:1, por debajo de AA para texto pequeño (4,5:1). Los colores de series siguen los valores del prompt. |
| 11 | Ola de las semanas (`v_semana_ola`): la ola n abarca desde su primer día hasta antes de la ola n+1. KPI-02/03/04 por ola usan ese segmento; KPI-01 usa la ola de la encuesta. | Las olas son ventanas de 2 semanas pero los registros son semanales; hace falta un criterio para filtrar KPI semanales por ola. |
| 12 | Medidas del Explorador `HorasSignificativas`, `MinutosActividad` y `DiasActividad` se muestran **por estudiante y semana** (dividido entre semanas distintas del grupo). | Comparable con KPI-02/04 y consistente al agrupar por mes, semana o día. |
| 13 | Los 12 primeros estudiantes del seed no tienen la ola 3 (diciembre) respondida. | Permite registrar una encuesta real desde «Mi bienestar» en la demostración. |
| 15 | «Exportar a PDF» usa la impresión del navegador (`@media print`). | Evita una dependencia pesada y mantiene el estilo; el PDF resultante es el que genera el navegador. |
| 16 | Los 7 reportes se diseñaron a partir de los títulos del prompt, sin tener el informe Word. | «Validado contra el diseño» compara columnas esperadas de mi diseño; debe contrastarse con el informe real. |
| 14 | Inicio de sesión real con **2 roles** (Bienestar y Estudiante), cada uno con sus módulos; se eliminó el rol Docente y el selector de rol de demostración. | Petición del usuario. Sesión JWT en cookie httpOnly; contraseñas con scrypt; permisos aplicados también en la API. |
| 15 | Se añadió la tabla `USUARIO` al OLTP (19.ª tabla) y 361 cuentas de demostración (1 de Bienestar y 1 por estudiante). | La autenticación necesita almacenar credenciales; no es parte del modelo del informe. |
| 16 | Bienestar no ve datos individuales: `/api/me` y `/api/log/*` son solo del estudiante. | Privacidad: el panel de gestión trabaja con agregados. |
| 17 | Se eliminaron de la interfaz y de la API: «Ver consulta SQL», el SQL de reportes/explorador/drivers/calidad, el Laboratorio SQL (`/api/sql*`, `/api/kpis/:id/sql`, usuario `bienestar_sqllab`) y el módulo Evidencia. | Petición del usuario: la app solo muestra información; la demostración con SQL se hace en SSMS con `Datos/05_kpi_queries.sql`. |
| 18 | Se eliminó el modo presentación y el buscador pasó a la barra superior. | Petición del usuario (poca utilidad; mejor ubicación). |
| 19 | Sin conexión con la API la web entra en **modo demostración** como Bienestar con JSON estático (solo lectura). | Requisito del prompt de datos de ejemplo siempre disponibles; sin API no hay forma de autenticar. |
| 20 | Se eliminó el tour de bienvenida. «Ajustes» y «Cerrar sesión» pasaron a un menú desplegable del perfil (nombre del usuario) y «Ajustes» salió del menú lateral. | Petición del usuario: ahorrar espacio en la barra y el menú. |
| 21 | El buscador de la barra superior es un campo de texto con resultados desplegables (antes un botón que abría una paleta modal); se quitó el rótulo «Ctrl K» y el atajo `Ctrl/⌘+K` solo enfoca el campo. | Petición del usuario. |
