/* 04b - Vistas v_datos* y procedimientos usp_ETL_* que usa la aplicacion web (boton Ejecutar ETL).
   Solo crea los objetos; la carga manual se hace con 04_etl_procedures.sql.   */
USE Mart_Bienestar;
GO

-- Vistas de extracción y limpieza (leen el OLTP)
CREATE OR ALTER VIEW v_datosTiempo AS
SELECT DISTINCT
  Anual            = YEAR(f.fecha),
  Semestre         = CAST(YEAR(f.fecha) AS VARCHAR(4)) + '-' + IIF(MONTH(f.fecha) < 7, 'S1', 'S2'),
  Trimestre        = CAST(YEAR(f.fecha) AS VARCHAR(4)) + '-T' + CAST(DATEPART(QUARTER, f.fecha) AS VARCHAR(1)),
  Mes              = DATENAME(MONTH, f.fecha),
  Semana           = DATEPART(ISO_WEEK, f.fecha),
  InicioSemana     = DATEADD(DAY, -(DATEDIFF(DAY, '19000101', f.fecha) % 7), f.fecha),  -- lunes
  DiaSemana        = DATENAME(WEEKDAY, f.fecha),
  PeriodoAcademico = pa.codigo,
  OlaMedicion      = CAST(om.numero AS VARCHAR(10)),
  idfecha          = CAST(f.fecha AS DATE)
FROM (
  -- Calendario completo de los periodos que tienen olas de medicion (para poder contar semanas con 0)
  SELECT DATEADD(DAY, n.n, p.fecha_inicio) AS fecha
  FROM BienestarOLTP.dbo.PERIODO_ACADEMICO p
  JOIN (SELECT DISTINCT id_periodo FROM BienestarOLTP.dbo.OLA_MEDICION) o ON o.id_periodo = p.id_periodo
  CROSS APPLY (SELECT TOP (DATEDIFF(DAY, p.fecha_inicio, p.fecha_fin) + 1)
                      ROW_NUMBER() OVER (ORDER BY (SELECT 1)) - 1 AS n
               FROM sys.all_objects a CROSS JOIN sys.all_objects b) n
  UNION SELECT fecha_aplicacion FROM BienestarOLTP.dbo.ENCUESTA_BIENESTAR
  UNION SELECT fecha FROM BienestarOLTP.dbo.REGISTRO_INTERACCION
  UNION SELECT fecha FROM BienestarOLTP.dbo.REGISTRO_ACTIVIDAD
) f
LEFT JOIN BienestarOLTP.dbo.PERIODO_ACADEMICO pa ON f.fecha BETWEEN pa.fecha_inicio AND pa.fecha_fin
LEFT JOIN BienestarOLTP.dbo.OLA_MEDICION om ON om.id_periodo = pa.id_periodo
                                           AND f.fecha BETWEEN om.fecha_inicio AND om.fecha_fin;
GO

-- CORRECCIONES 3 y 4: matrícula más reciente (una fila por estudiante) y edad a fecha fija
CREATE OR ALTER VIEW v_datosEstudiante AS
SELECT
  RangoEdad = CASE
      WHEN x.edad BETWEEN 18 AND 20 THEN '18 a 20'
      WHEN x.edad BETWEEN 21 AND 23 THEN '21 a 23'
      ELSE '24 o más' END,
  Sexo           = e.sexo,
  CicloEstudios  = x.ciclo,
  RangoIngreso   = ISNULL(ri.descripcion, 'No informa'),
  cod_estudiante = e.cod_estudiante
FROM BienestarOLTP.dbo.ESTUDIANTE e
LEFT JOIN BienestarOLTP.dbo.RANGO_INGRESO ri ON ri.id_rango = e.id_rango
OUTER APPLY (
  SELECT TOP 1 m.ciclo, p.fecha_inicio AS ref,
         edad = DATEDIFF(YEAR, e.fecha_nacimiento, p.fecha_inicio)
              - IIF(DATEADD(YEAR, DATEDIFF(YEAR, e.fecha_nacimiento, p.fecha_inicio), e.fecha_nacimiento) > p.fecha_inicio, 1, 0)
  FROM BienestarOLTP.dbo.MATRICULA m
  JOIN BienestarOLTP.dbo.PERIODO_ACADEMICO p ON p.id_periodo = m.id_periodo
  WHERE m.cod_estudiante = e.cod_estudiante
  ORDER BY p.fecha_inicio DESC
) x;
GO

CREATE OR ALTER VIEW v_datosProgramaAcademico AS
SELECT Escuela = esc.nombre, Facultad = fac.nombre, id_escuela = esc.id_escuela
FROM BienestarOLTP.dbo.ESCUELA esc
JOIN BienestarOLTP.dbo.FACULTAD fac ON fac.id_facultad = esc.id_facultad;
GO

CREATE OR ALTER VIEW v_datosInteraccion AS
SELECT TipoInteraccion = ti.descripcion, TipoVinculo = tv.nombre, Modalidad = mo.nombre, id_tipo_inter = ti.id_tipo_inter
FROM BienestarOLTP.dbo.TIPO_INTERACCION ti
JOIN BienestarOLTP.dbo.TIPO_VINCULO tv ON tv.id_vinculo = ti.id_vinculo
JOIN BienestarOLTP.dbo.MODALIDAD   mo ON mo.id_modalidad = ti.id_modalidad;
GO

CREATE OR ALTER VIEW v_datosActividad AS
SELECT Actividad = a.nombre, TipoActividad = ta.nombre, Intensidad = i.nombre, id_actividad = a.id_actividad
FROM BienestarOLTP.dbo.ACTIVIDAD a
JOIN BienestarOLTP.dbo.TIPO_ACTIVIDAD ta ON ta.id_tipo_act = a.id_tipo_act
JOIN BienestarOLTP.dbo.INTENSIDAD i ON i.id_intensidad = a.id_intensidad;
GO

-- CORRECCIÓN 6: procedimientos idempotentes, con transacción y auditoría
CREATE OR ALTER PROCEDURE usp_ETL_Dimensiones AS
BEGIN
  SET NOCOUNT ON; SET LANGUAGE Spanish;
  DECLARE @run INT;
  INSERT AUDITORIA_ETL(paso) VALUES ('Dimensiones'); SET @run = SCOPE_IDENTITY();
  BEGIN TRY
    BEGIN TRAN;
    DECLARE @n INT = 0, @r INT;

    MERGE DimTiempo AS d USING v_datosTiempo AS o ON d.idfecha = o.idfecha
    WHEN MATCHED THEN UPDATE SET Anual=o.Anual, Semestre=o.Semestre, Trimestre=o.Trimestre, Mes=o.Mes,
         Semana=o.Semana, InicioSemana=o.InicioSemana, DiaSemana=o.DiaSemana,
         PeriodoAcademico=o.PeriodoAcademico, OlaMedicion=o.OlaMedicion
    WHEN NOT MATCHED THEN INSERT (Anual,Semestre,Trimestre,Mes,Semana,InicioSemana,DiaSemana,PeriodoAcademico,OlaMedicion,idfecha)
         VALUES (o.Anual,o.Semestre,o.Trimestre,o.Mes,o.Semana,o.InicioSemana,o.DiaSemana,o.PeriodoAcademico,o.OlaMedicion,o.idfecha);
    SET @n += @@ROWCOUNT;

    MERGE DimEstudiante AS d USING v_datosEstudiante AS o ON d.cod_estudiante = o.cod_estudiante
    WHEN MATCHED THEN UPDATE SET RangoEdad=o.RangoEdad, Sexo=o.Sexo, CicloEstudios=o.CicloEstudios, RangoIngreso=o.RangoIngreso
    WHEN NOT MATCHED THEN INSERT (RangoEdad,Sexo,CicloEstudios,RangoIngreso,cod_estudiante)
         VALUES (o.RangoEdad,o.Sexo,o.CicloEstudios,o.RangoIngreso,o.cod_estudiante);
    SET @n += @@ROWCOUNT;

    MERGE DimProgramaAcademico AS d USING v_datosProgramaAcademico AS o ON d.id_escuela = o.id_escuela
    WHEN MATCHED THEN UPDATE SET Escuela=o.Escuela, Facultad=o.Facultad
    WHEN NOT MATCHED THEN INSERT (Escuela,Facultad,id_escuela) VALUES (o.Escuela,o.Facultad,o.id_escuela);
    SET @n += @@ROWCOUNT;

    MERGE DimInteraccionSocial AS d USING v_datosInteraccion AS o ON d.id_tipo_inter = o.id_tipo_inter
    WHEN MATCHED THEN UPDATE SET TipoInteraccion=o.TipoInteraccion, TipoVinculo=o.TipoVinculo, Modalidad=o.Modalidad
    WHEN NOT MATCHED THEN INSERT (TipoInteraccion,TipoVinculo,Modalidad,id_tipo_inter)
         VALUES (o.TipoInteraccion,o.TipoVinculo,o.Modalidad,o.id_tipo_inter);
    SET @n += @@ROWCOUNT;

    MERGE DimActividad AS d USING v_datosActividad AS o ON d.id_actividad = o.id_actividad
    WHEN MATCHED THEN UPDATE SET Actividad=o.Actividad, TipoActividad=o.TipoActividad, Intensidad=o.Intensidad
    WHEN NOT MATCHED THEN INSERT (Actividad,TipoActividad,Intensidad,id_actividad)
         VALUES (o.Actividad,o.TipoActividad,o.Intensidad,o.id_actividad);
    SET @n += @@ROWCOUNT;

    COMMIT;
    UPDATE AUDITORIA_ETL SET fin=SYSDATETIME(), insertadas=@n, estado='OK' WHERE id_run=@run;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    UPDATE AUDITORIA_ETL SET fin=SYSDATETIME(), estado='ERROR', mensaje=LEFT(ERROR_MESSAGE(),500) WHERE id_run=@run;
    THROW;
  END CATCH
END;
GO

CREATE OR ALTER PROCEDURE usp_ETL_Hechos AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @run INT, @leidas INT, @ins INT = 0, @rech INT = 0;
  INSERT AUDITORIA_ETL(paso) VALUES ('Hechos'); SET @run = SCOPE_IDENTITY();
  BEGIN TRY
    BEGIN TRAN;
    -- Recarga completa: es idempotente (se puede ejecutar varias veces sin duplicar)
    DELETE FROM Hecho_Bienestar; DELETE FROM Hecho_Interaccion; DELETE FROM Hecho_Actividad;

    SELECT @leidas = (SELECT COUNT(*) FROM BienestarOLTP.dbo.ENCUESTA_BIENESTAR)
                   + (SELECT COUNT(*) FROM BienestarOLTP.dbo.REGISTRO_INTERACCION)
                   + (SELECT COUNT(*) FROM BienestarOLTP.dbo.REGISTRO_ACTIVIDAD);

    -- Rechazos de calidad: encuestas incompletas (no 5 respuestas) o aplicadas fuera de una ola
    SELECT @rech += COUNT(*) FROM (
      SELECT eb.id_encuesta FROM BienestarOLTP.dbo.ENCUESTA_BIENESTAR eb
      LEFT JOIN BienestarOLTP.dbo.RESPUESTA_SWLS rs ON rs.id_encuesta = eb.id_encuesta
      LEFT JOIN DimTiempo t ON t.idfecha = eb.fecha_aplicacion
      GROUP BY eb.id_encuesta, t.OlaMedicion
      HAVING COUNT(rs.id_item) <> 5 OR t.OlaMedicion IS NULL) q;
    -- Rechazos: actividades de menos de 10 minutos
    SELECT @rech += COUNT(*) FROM BienestarOLTP.dbo.REGISTRO_ACTIVIDAD WHERE duracion_min < 10;

    INSERT Hecho_Bienestar (KeyEstudiante, KeyTiempo, KeyPrograma, PuntajeSWLS)
    SELECT de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma, SUM(rs.valor)
    FROM BienestarOLTP.dbo.ENCUESTA_BIENESTAR eb
    JOIN BienestarOLTP.dbo.RESPUESTA_SWLS rs ON rs.id_encuesta = eb.id_encuesta
    JOIN BienestarOLTP.dbo.ESTUDIANTE est    ON est.cod_estudiante = eb.cod_estudiante
    JOIN DimEstudiante de ON de.cod_estudiante = est.cod_estudiante
    JOIN DimTiempo dt     ON dt.idfecha = CAST(eb.fecha_aplicacion AS DATE) AND dt.OlaMedicion IS NOT NULL
    JOIN DimProgramaAcademico dp ON dp.id_escuela = est.id_escuela
    GROUP BY eb.id_encuesta, de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma
    HAVING COUNT(rs.id_item) = 5;               -- solo encuestas completas
    SET @ins += @@ROWCOUNT;

    INSERT Hecho_Interaccion (KeyEstudiante, KeyTiempo, KeyPrograma, KeyInteraccion, HorasSignificativas, ValoracionInteraccion)
    SELECT de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma, di.KeyInteraccion,
           SUM(CASE WHEN ri.valoracion >= 4 THEN ri.duracion_horas ELSE 0 END),   -- solo valoración 4 o 5
           AVG(CAST(ri.valoracion AS DECIMAL(18,2)))
    FROM BienestarOLTP.dbo.REGISTRO_INTERACCION ri
    JOIN BienestarOLTP.dbo.ESTUDIANTE est ON est.cod_estudiante = ri.cod_estudiante
    JOIN DimEstudiante de ON de.cod_estudiante = est.cod_estudiante
    JOIN DimTiempo dt     ON dt.idfecha = CAST(ri.fecha AS DATE)
    JOIN DimProgramaAcademico dp ON dp.id_escuela = est.id_escuela
    JOIN DimInteraccionSocial di ON di.id_tipo_inter = ri.id_tipo_inter
    GROUP BY de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma, di.KeyInteraccion;
    SET @ins += @@ROWCOUNT;

    -- Actividad: solo registros de 10 minutos o más (regla de negocio)
    INSERT Hecho_Actividad (KeyEstudiante, KeyTiempo, KeyPrograma, KeyActividad, DiasActividad, MinutosActividad)
    SELECT de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma, da.KeyActividad,
           1,                                   -- un día con actividad por fila; NO sumar, ver KPI-04
           SUM(ra.duracion_min)
    FROM BienestarOLTP.dbo.REGISTRO_ACTIVIDAD ra
    JOIN BienestarOLTP.dbo.ESTUDIANTE est ON est.cod_estudiante = ra.cod_estudiante
    JOIN DimEstudiante de ON de.cod_estudiante = est.cod_estudiante
    JOIN DimTiempo dt     ON dt.idfecha = CAST(ra.fecha AS DATE)
    JOIN DimProgramaAcademico dp ON dp.id_escuela = est.id_escuela
    JOIN DimActividad da  ON da.id_actividad = ra.id_actividad
    WHERE ra.duracion_min >= 10
    GROUP BY de.KeyEstudiante, dt.KeyTiempo, dp.KeyPrograma, da.KeyActividad;
    SET @ins += @@ROWCOUNT;

    COMMIT;
    UPDATE AUDITORIA_ETL SET fin=SYSDATETIME(), leidas=@leidas, insertadas=@ins, rechazadas=@rech, estado='OK' WHERE id_run=@run;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    UPDATE AUDITORIA_ETL SET fin=SYSDATETIME(), estado='ERROR', mensaje=LEFT(ERROR_MESSAGE(),500) WHERE id_run=@run;
    THROW;
  END CATCH
END;
GO

CREATE OR ALTER PROCEDURE usp_ETL_Completo AS
BEGIN
  EXEC usp_ETL_Dimensiones;
  EXEC usp_ETL_Hechos;
END;
GO
