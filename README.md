# Bienestar BI

Aplicación web y móvil (PWA) de **Inteligencia de Negocios** para el seguimiento del **bienestar subjetivo de estudiantes universitarios**: 4 indicadores con semáforo (satisfacción con la vida, interacción social significativa, calidad relacional y actividad física), siete reportes de gestión, explorador analítico propio, un módulo para que el estudiante registre su bienestar y un coach de IA que solo interpreta los indicadores.

Proyecto del curso de Inteligencia de Negocios (Unidad 3, tema G3: *La Ciencia de la Felicidad y el Bienestar Subjetivo*). Plataforma asignada: AWS. Sin Power BI, Qlik ni Tableau: los visualizadores son componentes propios (React + Apache ECharts).

| Carpeta | Contenido |
|---|---|
| [`Datos/`](Datos) | Scripts SQL Server: OLTP, datos sintéticos reproducibles, Data Mart en estrella, ETL, consultas de los KPI y usuarios de BD |
| [`Software/`](Software) | `web/` (React + Vite), `api/` (Hono + Node), `infra/` (Docker), `docs/` (manuales) |
| [`Videos/`](Videos) | Guiones del video general (10 min) y del ejecutivo (3 min) |

**Para ejecutarlo:** consulta [`Software/README.md`](Software/README.md) (instalación en 10 minutos con Docker y credenciales de demostración).

> Todos los datos son **sintéticos**, generados para demostrar el diseño. Las contraseñas de demostración del README deben cambiarse antes de cualquier despliegue.
