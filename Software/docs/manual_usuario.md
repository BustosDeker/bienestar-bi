# Manual de usuario

Las capturas están en `docs/capturas/` (`<pantalla>-<desktop|mobile>-<light|dark>.png`).

## Ingreso y roles (`00-login-*`)
Ingresa con tu usuario y contraseña (hay botones de ayuda con las cuentas de demostración). Cada rol ve solo sus módulos:
- **Bienestar** (`bienestar`): Resumen, Reportes, Explorador, Drivers, Coach de IA, ETL y calidad y Ajustes.
- **Estudiante** (su código, p. ej. `202600002`): Mi bienestar y Ajustes. Solo ve y registra sus propios datos.
**Menú del perfil:** al pulsar tu nombre (Bienestar o tu código de estudiante) en la barra superior aparecen **Ajustes** y **Cerrar sesión**; así el menú lateral y la barra quedan despejados. La sesión caduca a las 8 horas.

## Primeros pasos
1. Abre `http://localhost:5173` e inicia sesión.
2. Barra lateral (escritorio) o barra inferior (móvil, con «Más» para el resto). El **buscador** está en la barra superior: escribe el nombre de un módulo o acción (tema, idioma, cerrar sesión) y elígelo con el ratón o con Enter. `Ctrl/⌘+K` te lleva directo al campo.
3. La **barra superior** reúne los filtros (solo Bienestar), el buscador y el menú del perfil. Los filtros (facultad, escuela, sexo, rango de edad, ola) afecta a todas las vistas. En móvil se abre con el botón «Filtros». El indicador `k=5` recuerda que los grupos con menos de 5 estudiantes se ocultan.
4. Atajos: `T` tema, `L` idioma, `?` lista de atajos.

## Resumen (`01-resumen-*`)
- **Tarjetas KPI**: valor animado, semáforo con icono y texto (Bueno/Regular/Malo), variación frente a la medición anterior, mini-evolución y meta.
- **Evolución del SWLS** con las líneas de umbral, **Hallazgos** generados automáticamente, **mapa de calor escuela × ola**, horas por tipo de vínculo y **Recomendaciones de IA** (se despliega al abrirlo).
- Cada gráfico tiene «Ver tabla de datos» (alternativa accesible).

## Reportes (`02-04-reporte-*`)
Elige R1 a R7. Clic en un encabezado ordena; clic en una fila la resalta. Los totales son promedios ponderados; las celdas con semáforo usan los umbrales de `CONFIG_KPI`. Una celda con **k** indica grupo oculto por privacidad. Botones **CSV** y **PDF** (imprimir/guardar como PDF). La insignia «Validado contra el diseño del informe» confirma la estructura de columnas (no las cifras).

## Explorador (`05-explorador-*`)
1. Elige una **medida**. 2. **Arrastra** dimensiones a Filas y Columnas (o usa los botones ↓ →). 3. Cambia el **tipo de gráfico** (barras, líneas, mapa de calor, tabla). 4. Agrega **segmentadores** (por ejemplo, Sexo = Mujer). 5. **Clic en una barra** = filtro cruzado: se actualiza la vista vinculada inferior; con «Bajar nivel» haces drill-down (Facultad→Escuela; Año→Mes→Semana→Día) y con «Subir nivel» regresas. 6. **Copiar enlace** reproduce la vista; **Guardar vista** la deja en este navegador.

## Drivers (`06-drivers-*`)
Ranking de vínculos y actividades según la diferencia de SWLS entre quienes les dedican más y menos tiempo, matriz de correlación de Spearman y dispersión. **Es descriptivo: asociación no es causalidad** (aviso permanente).

## Mi bienestar (`07-mi-bienestar-*`)
Se abre con el estudiante que inició sesión (código seudonimizado). Pestañas: **Resumen** (radar frente al grupo, línea de tiempo, racha de días con actividad y registros recientes), **Encuesta SWLS** (5 pasos con control deslizante 1 a 7; elige la ola pendiente), **Interacción** (vínculo, modalidad, horas, valoración 1–5), **Actividad** (actividad y minutos; menos de 10 min no cuenta para el KPI) y **Mi coach**. Los registros se escriben en el OLTP; el radar se actualiza tras ejecutar el ETL.

## Coach de IA (`08-coach-*`)
Pulsa «Interpretar indicadores»: se envían solo valores y estados agregados y se muestran 3 a 5 recomendaciones, cada una con su KPI de origen, en el idioma activo. Puedes copiar o exportar. Si KPI-01 está en rojo, la primera recomendación sugiere acudir a la oficina de bienestar. La fuente (motor de reglas o Bedrock) se indica siempre.

## ETL y calidad (`09-etl-*`)
«Ejecutar ETL» carga primero las dimensiones y luego los hechos, mostrando leídas, insertadas, rechazadas, duración y estado. Debajo: reglas de calidad con conteo de incumplimientos, historial de `AUDITORIA_ETL` y el **linaje** interactivo OLTP → vistas → ETL → Data Mart (clic en un nodo).

## Ajustes (`10-ajustes-*`)
Idioma (ES/EN), tema (claro/oscuro/sistema), color de acento, densidad, cuenta (cerrar sesión) y, para Bienestar, el umbral de privacidad k.

## Instalación como app
La app es una **PWA**: en Chrome/Edge usa «Instalar» y en el móvil «Añadir a pantalla de inicio». Si la API no responde, un aviso amarillo indica **modo demostración** con datos de ejemplo guardados.
