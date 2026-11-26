/*==============================================================================
 04 - ETL  (POBLAMIENTO DEL DATA MART Mart_Bienestar DESDE BienestarOLTP)
   - Dimensiones: «Preparando datos» (SELECT con JOIN) + MERGE ... WHEN NOT MATCHED THEN INSERT
   - Dimensión Tiempo: calendario de los periodos con olas + fechas de los tres procesos
   - Hechos: DELETE + INSERT ... SELECT, uniendo cada tabla transaccional con su
     dimensión por el id original para obtener las Key, y GROUP BY.
 Ejecutar después de 01_oltp_create, 02_seed_oltp y 03_mart_create.
 Puede ejecutarse varias veces: el MERGE no duplica dimensiones y los hechos se recargan.
==============================================================================*/

USE Mart_Bienestar;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;  -- requerido por el índice filtrado de DimTiempo
SET LANGUAGE Spanish;      -- nombres de mes y día en español (DATENAME)
GO

/*==============================================================================
 PARTE A. DIMENSIONES
==============================================================================*/

------------------------------------------------------------------ A.1 DimTiempo
-- Preparando datos: calendario completo de los periodos con olas de medición
-- (para poder contar semanas con 0) + fechas de encuestas, interacciones y actividades
MERGE Mart_Bienestar.dbo.DimTiempo AS dim USING
(SELECT DISTINCT
        Anual            = YEAR(f.fecha),
        Semestre         = CAST(YEAR(f.fecha) AS VARCHAR(4)) + '-' + IIF(MONTH(f.fecha) < 7, 'S1', 'S2'),
        Trimestre        = CAST(YEAR(f.fecha) AS VARCHAR(4)) + '-T' + CAST(DATEPART(QUARTER, f.fecha) AS VARCHAR(1)),
        Mes              = DATENAME(MONTH, f.fecha),
        Semana           = DATEPART(ISO_WEEK, f.fecha),
        InicioSemana     = DATEADD(DAY, -(DATEDIFF(DAY, '19000101', f.fecha) % 7), f.fecha),  -- lunes
        DiaSemana        = DATENAME(WEEKDAY, f.fecha),
        PeriodoAcademico = pa.codigo,
        OlaMedicion      = CAST(om.numero AS VARCHAR(10)),
        Fecha            = CAST(f.fecha AS DATE)
 FROM (SELECT fecha = DATEADD(DAY, n.n, p.fecha_inicio)
       FROM BienestarOLTP.dbo.PERIODO_ACADEMICO p
            INNER JOIN (SELECT DISTINCT id_periodo FROM BienestarOLTP.dbo.OLA_MEDICION) o ON o.id_periodo = p.id_periodo
            CROSS APPLY (SELECT TOP (DATEDIFF(DAY, p.fecha_inicio, p.fecha_fin) + 1)
                                n = ROW_NUMBER() OVER (ORDER BY (SELECT 1)) - 1
                         FROM sys.all_objects a CROSS JOIN sys.all_objects b) n
       UNION SELECT fecha_aplicacion FROM BienestarOLTP.dbo.ENCUESTA_BIENESTAR
       UNION SELECT fecha FROM BienestarOLTP.dbo.REGISTRO_INTERACCION
       UNION SELECT fecha FROM BienestarOLTP.dbo.REGISTRO_ACTIVIDAD) AS f
      LEFT JOIN BienestarOLTP.dbo.PERIODO_ACADEMICO pa ON f.fecha BETWEEN pa.fecha_inicio AND pa.fecha_fin
      LEFT JOIN BienestarOLTP.dbo.OLA_MEDICION om      ON om.id_periodo = pa.id_periodo
                                                      AND f.fecha BETWEEN om.fecha_inicio AND om.fecha_fin) AS oltp
ON oltp.Fecha = dim.idfecha
WHEN NOT MATCHED THEN
    INSERT (Anual, Semestre, Trimestre, Mes, Semana, InicioSemana, DiaSemana, PeriodoAcademico, OlaMedicion, idfecha)
    VALUES (Anual, Semestre, Trimestre, Mes, Semana, InicioSemana, DiaSemana, PeriodoAcademico, OlaMedicion, Fecha);
GO

------------------------------------------------------------------ A.2 DimEstudiante
-- Preparando datos: ESTUDIANTE + RANGO_INGRESO + matrícula más reciente (una fila por estudiante)
MERGE Mart_Bienestar.dbo.DimEstudiante AS dim USING
(SELECT RangoEdad = CASE WHEN x.edad BETWEEN 18 AND 20 THEN '18 a 20'
                         WHEN x.edad BETWEEN 21 AND 23 THEN '21 a 23'
                         ELSE '24 o más' END,
        Sexo          = e.sexo,
        CicloEstudios = x.ciclo,
        RangoIngreso  = ISNULL(ri.descripcion, 'No informa'),
        cod_estudiante = e.cod_estudiante
 FROM BienestarOLTP.dbo.ESTUDIANTE e
      LEFT JOIN BienestarOLTP.dbo.RANGO_INGRESO ri ON ri.id_rango = e.id_rango
      OUTER APPLY (SELECT TOP 1 m.ciclo,
                          -- edad cumplida al inicio del periodo de la matrícula
                          edad = DATEDIFF(YEAR, e.fecha_nacimiento, p.fecha_inicio)
                               - IIF(DATEADD(YEAR, DATEDIFF(YEAR, e.fecha_nacimiento, p.fecha_inicio), e.fecha_nacimiento) > p.fecha_inicio, 1, 0)
                   FROM BienestarOLTP.dbo.MATRICULA m
                        INNER JOIN BienestarOLTP.dbo.PERIODO_ACADEMICO p ON p.id_periodo = m.id_periodo
                   WHERE m.cod_estudiante = e.cod_estudiante
                   ORDER BY p.fecha_inicio DESC) x) AS oltp
ON oltp.cod_estudiante = dim.cod_estudiante
WHEN NOT MATCHED THEN
    INSERT (RangoEdad, Sexo, CicloEstudios, RangoIngreso, cod_estudiante)
    VALUES (RangoEdad, Sexo, CicloEstudios, RangoIngreso, cod_estudiante);
GO

------------------------------------------------------------------ A.3 DimProgramaAcademico
-- Preparando datos: ESCUELA + FACULTAD
MERGE Mart_Bienestar.dbo.DimProgramaAcademico AS dim USING
(SELECT Escuela = esc.nombre, Facultad = fac.nombre, id_escuela = esc.id_escuela
 FROM BienestarOLTP.dbo.ESCUELA esc
      INNER JOIN BienestarOLTP.dbo.FACULTAD fac ON fac.id_facultad = esc.id_facultad) AS oltp
ON oltp.id_escuela = dim.id_escuela
WHEN NOT MATCHED THEN
    INSERT (Escuela, Facultad, id_escuela)
    VALUES (Escuela, Facultad, id_escuela);
GO

------------------------------------------------------------------ A.4 DimInteraccionSocial
-- Preparando datos: TIPO_INTERACCION + TIPO_VINCULO + MODALIDAD
MERGE Mart_Bienestar.dbo.DimInteraccionSocial AS dim USING
(SELECT TipoInteraccion = ti.descripcion, TipoVinculo = tv.nombre, Modalidad = mo.nombre,
        id_tipo_inter = ti.id_tipo_inter
 FROM BienestarOLTP.dbo.TIPO_INTERACCION ti
      INNER JOIN BienestarOLTP.dbo.TIPO_VINCULO tv ON tv.id_vinculo = ti.id_vinculo
      INNER JOIN BienestarOLTP.dbo.MODALIDAD mo    ON mo.id_modalidad = ti.id_modalidad) AS oltp
ON oltp.id_tipo_inter = dim.id_tipo_inter
WHEN NOT MATCHED THEN
    INSERT (TipoInteraccion, TipoVinculo, Modalidad, id_tipo_inter)
    VALUES (TipoInteraccion, TipoVinculo, Modalidad, id_tipo_inter);
GO

------------------------------------------------------------------ A.5 DimActividad
-- Preparando datos: ACTIVIDAD + TIPO_ACTIVIDAD + INTENSIDAD
MERGE Mart_Bienestar.dbo.DimActividad AS dim USING
(SELECT Actividad = a.nombre, TipoActividad = ta.nombre, Intensidad = i.nombre, id_actividad = a.id_actividad
 FROM BienestarOLTP.dbo.ACTIVIDAD a
      INNER JOIN BienestarOLTP.dbo.TIPO_ACTIVIDAD ta ON ta.id_tipo_act = a.id_tipo_act
      INNER JOIN BienestarOLTP.dbo.INTENSIDAD i      ON i.id_intensidad = a.id_intensidad) AS oltp
ON oltp.id_actividad = dim.id_actividad
WHEN NOT MATCHED THEN
    INSERT (Actividad, TipoActividad, Intensidad, id_actividad)
    VALUES (Actividad, TipoActividad, Intensidad, id_actividad);
GO

/*==============================================================================
 PARTE B. HECHOS
==============================================================================*/

------------------------------------------------------------------ B.1 Hecho_Bienestar
-- Una fila por encuesta completa (5 respuestas) aplicada dentro de una ola
DELETE FROM Mart_Bienestar.dbo.Hecho_Bienestar;
GO
INSERT INTO Mart_Bienestar.dbo.Hecho_Bienestar (KeyEstudiante, KeyTiempo, KeyPrograma, PuntajeSWLS)
SELECT de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma,
       PuntajeSWLS = SUM(rs.valor)
FROM BienestarOLTP.dbo.ENCUESTA_BIENESTAR eb
     INNER JOIN BienestarOLTP.dbo.RESPUESTA_SWLS rs           ON rs.id_encuesta = eb.id_encuesta
     INNER JOIN BienestarOLTP.dbo.ESTUDIANTE est              ON est.cod_estudiante = eb.cod_estudiante
     INNER JOIN Mart_Bienestar.dbo.DimEstudiante de           ON de.cod_estudiante = est.cod_estudiante
     INNER JOIN Mart_Bienestar.dbo.DimTiempo dt               ON dt.idfecha = eb.fecha_aplicacion
     INNER JOIN Mart_Bienestar.dbo.DimProgramaAcademico dp    ON dp.id_escuela = est.id_escuela
WHERE dt.OlaMedicion IS NOT NULL
GROUP BY eb.id_encuesta, de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma
HAVING COUNT(rs.id_item) = 5;
GO

------------------------------------------------------------------ B.2 Hecho_Interaccion
-- Horas significativas: solo las interacciones con valoración 4 o 5
DELETE FROM Mart_Bienestar.dbo.Hecho_Interaccion;
GO
INSERT INTO Mart_Bienestar.dbo.Hecho_Interaccion
(KeyEstudiante, KeyTiempo, KeyPrograma, KeyInteraccion, HorasSignificativas, ValoracionInteraccion)
SELECT de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma, di.KeyInteraccion,
       HorasSignificativas   = SUM(CASE WHEN ri.valoracion >= 4 THEN ri.duracion_horas ELSE 0 END),
       ValoracionInteraccion = AVG(CAST(ri.valoracion AS DECIMAL(18,2)))
FROM BienestarOLTP.dbo.REGISTRO_INTERACCION ri
     INNER JOIN BienestarOLTP.dbo.ESTUDIANTE est              ON est.cod_estudiante = ri.cod_estudiante
     INNER JOIN Mart_Bienestar.dbo.DimEstudiante de           ON de.cod_estudiante = est.cod_estudiante
     INNER JOIN Mart_Bienestar.dbo.DimTiempo dt               ON dt.idfecha = ri.fecha
     INNER JOIN Mart_Bienestar.dbo.DimProgramaAcademico dp    ON dp.id_escuela = est.id_escuela
     INNER JOIN Mart_Bienestar.dbo.DimInteraccionSocial di    ON di.id_tipo_inter = ri.id_tipo_inter
GROUP BY de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma, di.KeyInteraccion;
GO

------------------------------------------------------------------ B.3 Hecho_Actividad
-- Solo registros de 10 minutos o más (regla de negocio)
-- DiasActividad vale 1 por fila y NO se suma (ver KPI-04)
DELETE FROM Mart_Bienestar.dbo.Hecho_Actividad;
GO
INSERT INTO Mart_Bienestar.dbo.Hecho_Actividad
(KeyEstudiante, KeyTiempo, KeyPrograma, KeyActividad, DiasActividad, MinutosActividad)
SELECT de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma, da.KeyActividad,
       DiasActividad    = 1,
       MinutosActividad = SUM(ra.duracion_min)
FROM BienestarOLTP.dbo.REGISTRO_ACTIVIDAD ra
     INNER JOIN BienestarOLTP.dbo.ESTUDIANTE est              ON est.cod_estudiante = ra.cod_estudiante
     INNER JOIN Mart_Bienestar.dbo.DimEstudiante de           ON de.cod_estudiante = est.cod_estudiante
     INNER JOIN Mart_Bienestar.dbo.DimTiempo dt               ON dt.idfecha = ra.fecha
     INNER JOIN Mart_Bienestar.dbo.DimProgramaAcademico dp    ON dp.id_escuela = est.id_escuela
     INNER JOIN Mart_Bienestar.dbo.DimActividad da            ON da.id_actividad = ra.id_actividad
WHERE ra.duracion_min >= 10
GROUP BY de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma, da.KeyActividad;
GO

/*==============================================================================
 PARTE C. VISTAS DE ANÁLISIS (las usan 05_kpi_queries y la aplicación web)
==============================================================================*/

-- Programa de cada estudiante
CREATE OR ALTER VIEW v_estudiante_programa AS
SELECT DISTINCT KeyEstudiante, KeyPrograma FROM (
  SELECT KeyEstudiante, KeyPrograma FROM Hecho_Bienestar
  UNION SELECT KeyEstudiante, KeyPrograma FROM Hecho_Interaccion
  UNION SELECT KeyEstudiante, KeyPrograma FROM Hecho_Actividad) x;
GO
-- Segmento de ola de cada semana: la ola n va desde su primer día hasta antes de la ola n+1
CREATE OR ALTER VIEW v_semana_ola AS
SELECT DISTINCT t.InicioSemana,
  Ola = (SELECT MAX(o.n) FROM (SELECT n = CAST(OlaMedicion AS INT), ini = MIN(idfecha)
                               FROM DimTiempo WHERE OlaMedicion IS NOT NULL GROUP BY OlaMedicion) o
         WHERE o.ini <= t.InicioSemana)
FROM DimTiempo t WHERE t.InicioSemana IS NOT NULL;
GO
-- Calendario estudiante x semana. Semana observada = con al menos un registro de interacción o actividad
CREATE OR ALTER VIEW v_calendario AS
SELECT e.KeyEstudiante, ep.KeyPrograma, s.InicioSemana
FROM DimEstudiante e
JOIN v_estudiante_programa ep ON ep.KeyEstudiante = e.KeyEstudiante
CROSS JOIN (
  SELECT DISTINCT t.InicioSemana
  FROM DimTiempo t
  WHERE t.KeyTiempo IN (SELECT KeyTiempo FROM Hecho_Interaccion UNION SELECT KeyTiempo FROM Hecho_Actividad)
) s;
GO

/*==============================================================================
 PARTE D. VERIFICACIÓN — filas por tabla y totales contra la base transaccional
==============================================================================*/

-- Filas por tabla del data mart
SELECT t.name AS tabla, SUM(p.rows) AS filas
FROM sys.tables t INNER JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
GROUP BY t.name ORDER BY t.name;

-- Cada par de columnas «mart» y «oltp» debe coincidir
SELECT 'Hecho_Bienestar' AS hecho,
       mart = (SELECT COUNT(*) FROM Hecho_Bienestar),
       oltp = (SELECT COUNT(*) FROM (SELECT eb.id_encuesta
                                     FROM BienestarOLTP.dbo.ENCUESTA_BIENESTAR eb
                                          INNER JOIN BienestarOLTP.dbo.RESPUESTA_SWLS rs ON rs.id_encuesta = eb.id_encuesta
                                     WHERE EXISTS (SELECT 1 FROM BienestarOLTP.dbo.OLA_MEDICION o
                                                   WHERE eb.fecha_aplicacion BETWEEN o.fecha_inicio AND o.fecha_fin)
                                     GROUP BY eb.id_encuesta HAVING COUNT(*) = 5) q)
UNION ALL
SELECT 'Hecho_Interaccion (horas significativas)',
       (SELECT SUM(HorasSignificativas) FROM Hecho_Interaccion),
       (SELECT SUM(duracion_horas) FROM BienestarOLTP.dbo.REGISTRO_INTERACCION WHERE valoracion >= 4)
UNION ALL
SELECT 'Hecho_Actividad (minutos)',
       (SELECT SUM(MinutosActividad) FROM Hecho_Actividad),
       (SELECT SUM(duracion_min) FROM BienestarOLTP.dbo.REGISTRO_ACTIVIDAD WHERE duracion_min >= 10);
GO
