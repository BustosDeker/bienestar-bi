/* 05 - Consultas de los 4 KPI y de los 7 reportes de gestion (Mart_Bienestar)
   Semana observada = semana (InicioSemana) con al menos un registro de interaccion o actividad.
   Calendario = DimEstudiante x semanas observadas; las semanas sin registros cuentan 0 (correccion 5). */
USE Mart_Bienestar;
GO

/* El calendario estudiante x semana (v_calendario) se define en 04_etl_procedures.sql */

/* ---------------- KPI ---------------- */
-- KPI-01: promedio de PuntajeSWLS (5..35), por ola
SELECT dt.OlaMedicion, AVG(CAST(h.PuntajeSWLS AS FLOAT)) AS KPI01
FROM Hecho_Bienestar h JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
GROUP BY dt.OlaMedicion ORDER BY dt.OlaMedicion;

-- Variacion del puntaje por estudiante (LAG, no se almacena)
WITH p AS (
  SELECT h.KeyEstudiante, dt.OlaMedicion, h.PuntajeSWLS
  FROM Hecho_Bienestar h JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
)
SELECT KeyEstudiante, OlaMedicion, PuntajeSWLS,
       VariacionPuntajeSWLS = PuntajeSWLS - LAG(PuntajeSWLS) OVER (PARTITION BY KeyEstudiante ORDER BY OlaMedicion)
FROM p;

-- KPI-02: horas semanales de interaccion significativa (semanas sin registros = 0)
SELECT AVG(CAST(ISNULL(x.horas, 0) AS FLOAT)) AS KPI02
FROM v_calendario c
LEFT JOIN (
  SELECT h.KeyEstudiante, dt.InicioSemana, SUM(h.HorasSignificativas) AS horas
  FROM Hecho_Interaccion h JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  GROUP BY h.KeyEstudiante, dt.InicioSemana) x
  ON x.KeyEstudiante = c.KeyEstudiante AND x.InicioSemana = c.InicioSemana;

-- KPI-03: indice de calidad relacional (promedio de ValoracionInteraccion, 1..5)
-- Nota: promedio de promedios por (estudiante, dia, tipo); no se pondera por numero de registros.
SELECT AVG(h.ValoracionInteraccion) AS KPI03 FROM Hecho_Interaccion h;

-- KPI-04: dias semanales de actividad fisica (fechas DISTINTAS, 0..7; semanas sin actividad = 0)
SELECT AVG(CAST(ISNULL(x.dias, 0) AS FLOAT)) AS KPI04
FROM v_calendario c
LEFT JOIN (
  SELECT h.KeyEstudiante, dt.InicioSemana, COUNT(DISTINCT h.KeyTiempo) AS dias
  FROM Hecho_Actividad h
  JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  JOIN DimActividad da ON da.KeyActividad = h.KeyActividad
  WHERE da.TipoActividad = 'Actividad física'
  GROUP BY h.KeyEstudiante, dt.InicioSemana) x
  ON x.KeyEstudiante = c.KeyEstudiante AND x.InicioSemana = c.InicioSemana;
GO

/* ---------------- Reportes de gestion (R1 a R7) ---------------- */
-- R1: SWLS por escuela (subtotal por facultad) y rango de edad
SELECT Facultad = CASE WHEN GROUPING(dp.Facultad)=1 THEN 'TOTAL' ELSE dp.Facultad END,
       Escuela  = CASE WHEN GROUPING(dp.Escuela)=1 THEN '(subtotal)' ELSE dp.Escuela END,
       de.RangoEdad,
       Estudiantes = COUNT(DISTINCT h.KeyEstudiante),
       SWLS = AVG(CAST(h.PuntajeSWLS AS FLOAT))
FROM Hecho_Bienestar h
JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
JOIN DimProgramaAcademico dp ON dp.KeyPrograma = h.KeyPrograma
GROUP BY GROUPING SETS ((dp.Facultad, dp.Escuela, de.RangoEdad), (dp.Facultad, dp.Escuela), (dp.Facultad), ())
ORDER BY GROUPING(dp.Facultad), dp.Facultad, GROUPING(dp.Escuela), dp.Escuela, de.RangoEdad;

-- R2: horas semanales significativas por vinculo y modalidad x rango de edad
-- (suma de horas / (estudiantes del rango x semanas observadas))
WITH sem AS (SELECT COUNT(DISTINCT InicioSemana) AS n FROM v_calendario),
     est AS (SELECT RangoEdad, COUNT(*) AS n FROM DimEstudiante GROUP BY RangoEdad)
SELECT di.TipoVinculo, di.Modalidad, de.RangoEdad,
       HorasSemanales = SUM(h.HorasSignificativas) / (MAX(est.n) * 1.0 * MAX(sem.n))
FROM Hecho_Interaccion h
JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
JOIN DimInteraccionSocial di ON di.KeyInteraccion = h.KeyInteraccion
JOIN est ON est.RangoEdad = de.RangoEdad
CROSS JOIN sem
GROUP BY di.TipoVinculo, di.Modalidad, de.RangoEdad
ORDER BY di.TipoVinculo, di.Modalidad, de.RangoEdad;

-- R3: dias semanales de actividad fisica y de autocuidado x rango de edad
WITH sem AS (SELECT DISTINCT InicioSemana FROM v_calendario),
     d AS (
  SELECT h.KeyEstudiante, dt.InicioSemana, da.TipoActividad, COUNT(DISTINCT h.KeyTiempo) AS dias
  FROM Hecho_Actividad h
  JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  JOIN DimActividad da ON da.KeyActividad = h.KeyActividad
  GROUP BY h.KeyEstudiante, dt.InicioSemana, da.TipoActividad),
     tipos AS (SELECT DISTINCT TipoActividad FROM DimActividad)
SELECT t.TipoActividad, de.RangoEdad,
       DiasSemanales = AVG(CAST(ISNULL(d.dias, 0) AS FLOAT))
FROM DimEstudiante de CROSS JOIN sem CROSS JOIN tipos t
LEFT JOIN d ON d.KeyEstudiante = de.KeyEstudiante AND d.InicioSemana = sem.InicioSemana AND d.TipoActividad = t.TipoActividad
GROUP BY t.TipoActividad, de.RangoEdad
ORDER BY t.TipoActividad, de.RangoEdad;

-- R4: evolucion del SWLS por ola, con variacion y estado (umbrales de CONFIG_KPI en OLTP)
WITH o AS (
  SELECT dt.OlaMedicion, SWLS = AVG(CAST(h.PuntajeSWLS AS FLOAT)), n = COUNT(*)
  FROM Hecho_Bienestar h JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
  GROUP BY dt.OlaMedicion)
SELECT OlaMedicion, SWLS, n AS Encuestas,
       Variacion = SWLS - LAG(SWLS) OVER (ORDER BY OlaMedicion),
       Estado = CASE WHEN SWLS >= k.umbral_bueno THEN 'Bueno' WHEN SWLS >= k.umbral_regular THEN 'Regular' ELSE 'Malo' END
FROM o CROSS JOIN BienestarOLTP.dbo.CONFIG_KPI k
WHERE k.kpi = 'KPI-01'
ORDER BY OlaMedicion;

-- R5: valoracion de interacciones e intensidad de actividad por sexo
SELECT Bloque = 'Valoración por vínculo', de.Sexo, Grupo = di.TipoVinculo,
       Valor = AVG(h.ValoracionInteraccion)
FROM Hecho_Interaccion h
JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
JOIN DimInteraccionSocial di ON di.KeyInteraccion = h.KeyInteraccion
GROUP BY de.Sexo, di.TipoVinculo
UNION ALL
SELECT 'Minutos por intensidad', de.Sexo, da.Intensidad, AVG(CAST(h.MinutosActividad AS FLOAT))
FROM Hecho_Actividad h
JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
JOIN DimActividad da ON da.KeyActividad = h.KeyActividad
GROUP BY de.Sexo, da.Intensidad
ORDER BY 1, 2, 3;

-- R6: seguimiento semanal por mes (horas significativas, valoracion, dias de actividad fisica)
WITH i AS (
  SELECT dt.InicioSemana, SUM(h.HorasSignificativas) AS horas, AVG(h.ValoracionInteraccion) AS valoracion
  FROM Hecho_Interaccion h JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo GROUP BY dt.InicioSemana),
     a AS (
  SELECT x.InicioSemana, AVG(CAST(x.dias AS FLOAT)) AS dias FROM (
    SELECT h.KeyEstudiante, dt.InicioSemana, COUNT(DISTINCT h.KeyTiempo) AS dias
    FROM Hecho_Actividad h JOIN DimTiempo dt ON dt.KeyTiempo = h.KeyTiempo
    JOIN DimActividad da ON da.KeyActividad = h.KeyActividad AND da.TipoActividad = 'Actividad física'
    GROUP BY h.KeyEstudiante, dt.InicioSemana) x GROUP BY x.InicioSemana),
     nest AS (SELECT COUNT(*) AS n FROM DimEstudiante),
     sem AS (SELECT InicioSemana, Semana, Mes = MAX(CASE WHEN idfecha = InicioSemana THEN Mes END)   -- mes del lunes (en espanol)
             FROM DimTiempo WHERE InicioSemana IN (SELECT InicioSemana FROM i) GROUP BY InicioSemana, Semana)
SELECT sem.Mes, sem.Semana, sem.InicioSemana,
       HorasPorEstudiante = i.horas / nest.n, i.valoracion AS Valoracion,
       DiasActividadFisica = a.dias * 1.0
FROM sem JOIN i ON i.InicioSemana = sem.InicioSemana
LEFT JOIN a ON a.InicioSemana = sem.InicioSemana CROSS JOIN nest
ORDER BY sem.InicioSemana;

-- R7: SWLS por ciclo de estudios y rango de ingreso
SELECT de.CicloEstudios, de.RangoIngreso,
       Estudiantes = COUNT(DISTINCT h.KeyEstudiante), SWLS = AVG(CAST(h.PuntajeSWLS AS FLOAT))
FROM Hecho_Bienestar h JOIN DimEstudiante de ON de.KeyEstudiante = h.KeyEstudiante
GROUP BY de.CicloEstudios, de.RangoIngreso
ORDER BY de.CicloEstudios, de.RangoIngreso;
