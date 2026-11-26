# Guion del video general (10 minutos)

Preparación: `docker compose up -d`, API y web en marcha, dos ventanas: una con sesión **Bienestar** y otra (privada) con un **Estudiante**, idioma ES, tema claro. Abrir el SQL de `Datos/05_kpi_queries.sql` en una pestaña.

| Min | Qué se muestra | Qué se dice |
|---|---|---|
| 0:00–0:45 | **Inicio de sesión** y Resumen | Mostrar que hay dos roles: entrar como `bienestar` y ver el menú completo; más adelante, como estudiante, el menú reducido. |
| 0:45–1:00 | Portada y **Resumen** | Tema G3: ciencia de la felicidad y bienestar subjetivo. Plataforma AWS. Prohibidas las herramientas de BI comerciales: los visualizadores son propios (React + ECharts). La IA solo interpreta; no se entrena ningún modelo. |
| 0:45–1:45 | Arquitectura (manual técnico) | OLTP `BienestarOLTP` (18 tablas) → ETL con `usp_ETL_*` → Data Mart `Mart_Bienestar` en estrella (5 dimensiones, 3 hechos) → API → web/PWA. Docker en desarrollo, RDS for SQL Server Express en AWS. |
| 1:45–3:00 | **Resumen**: tarjetas KPI | Cuatro KPI con semáforo (icono + texto). **Demostración con SQL en SSMS** (fuera de la app): ejecutar la consulta de KPI-01 y KPI-04 de `Datos/05_kpi_queries.sql` y comparar el valor con la tarjeta. Destacar KPI-04 (`COUNT(DISTINCT)`, medida no aditiva) y el calendario estudiante × semana (0 en semanas sin actividad). |
| 3:00–3:45 | Evolución, hallazgos, mapa de calor | SWLS por ola con umbrales; hallazgos automáticos (Ing. Civil más baja, Educación más alta); heatmap escuela × ola. Filtrar por escuela y mostrar que todo se actualiza. |
| 3:45–5:00 | **Reportes R1 a R7** | Recorrer R1 (subtotales por facultad), R2 (total semanal con semáforo KPI-02), R4 (variación con `LAG`), R6 (seguimiento semanal). Ordenar una columna, resaltar una fila, exportar CSV, insignia de validación. |
| 5:00–6:00 | **Explorador** | Medida SWLS, arrastrar Escuela y Ola, segmentador Sexo, clic en una barra (filtro cruzado), bajar de nivel Facultad→Escuela, copiar enlace. |
| 6:00–6:45 | **Drivers** | Ranking de vínculos/actividades, matriz de Spearman, dispersión. Insistir en el aviso: asociación no es causalidad (Caycho-Rodríguez 2026, Cárdenas 2026, Waldinger y Schulz 2023). |
| 6:45–7:45 | **Mi bienestar** | Cerrar sesión y entrar como estudiante (`202600002`): solo ve Mi bienestar y Ajustes; encuesta SWLS de 5 pasos y enviar; registrar una interacción y una actividad. Mostrar el radar, la racha y el registro reciente. Aclarar que escribe en el OLTP. |
| 7:45–8:30 | **ETL y calidad** | «Ejecutar ETL»: dimensiones y luego hechos, con leídas/insertadas/rechazadas. Reglas de calidad (encuestas incompletas, fuera de ola, actividades < 10 min). Linaje. Volver a **Resumen** para ver que cambió el radar/KPI. |
| 8:30–9:15 | **Coach de IA** | Interpretar indicadores; cada recomendación indica su KPI. Motor `rules` por defecto y Bedrock opcional con caída automática. Solo agregados; recomendación de bienestar si KPI-01 en rojo. |
| 9:15–9:45 | Privacidad y ETL en SSMS | Subir k en Ajustes y ver grupos ocultos (k-anonimato). En SSMS, mostrar `AUDITORIA_ETL` tras ejecutar el ETL desde la app. |
| 9:45–10:00 | Cierre | Antecedentes y trazabilidad (en el informe), límites (datos sintéticos, estudios correlacionales), próximo paso: despliegue en AWS cambiando `.env`. |

Recordatorios: no mostrar contraseñas; mencionar que el probar idioma EN con `L` si sobra tiempo.
