/* 03 - Mart_Bienestar: dimensiones y hechos (PARTE C) */

USE Mart_Bienestar;
GO

CREATE TABLE DimTiempo (
  KeyTiempo        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  Anual            INT NULL,
  Semestre         VARCHAR(50) NULL,
  Trimestre        VARCHAR(50) NULL,
  Mes              VARCHAR(50) NULL,
  Semana           INT NULL,            -- CORRECCIÓN 1: nivel Semana (ISO)
  InicioSemana     DATE NULL,           -- lunes de esa semana
  DiaSemana        VARCHAR(50) NULL,
  PeriodoAcademico VARCHAR(50) NULL,
  OlaMedicion      VARCHAR(50) NULL,
  idfecha          DATE NULL
);
CREATE UNIQUE INDEX UX_DimTiempo_fecha ON DimTiempo(idfecha) WHERE idfecha IS NOT NULL;

CREATE TABLE DimEstudiante (
  KeyEstudiante  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  RangoEdad      VARCHAR(50) NULL,
  Sexo           CHAR(1) NULL,
  CicloEstudios  INT NULL,
  RangoIngreso   VARCHAR(50) NULL,
  cod_estudiante INT NULL
);
CREATE UNIQUE INDEX UX_DimEstudiante_cod ON DimEstudiante(cod_estudiante);

CREATE TABLE DimProgramaAcademico (
  KeyPrograma INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  Escuela     VARCHAR(100) NULL,
  Facultad    VARCHAR(100) NULL,
  id_escuela  INT NULL
);
CREATE TABLE DimInteraccionSocial (
  KeyInteraccion  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  TipoInteraccion VARCHAR(100) NULL,
  TipoVinculo     VARCHAR(50) NULL,
  Modalidad       VARCHAR(50) NULL,
  id_tipo_inter   INT NULL
);
CREATE TABLE DimActividad (
  KeyActividad  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  Actividad     VARCHAR(100) NULL,
  TipoActividad VARCHAR(50) NULL,
  Intensidad    VARCHAR(50) NULL,
  id_actividad  INT NULL
);

CREATE TABLE Hecho_Bienestar (
  KeyEstudiante INT NOT NULL REFERENCES DimEstudiante(KeyEstudiante),
  KeyTiempo     INT NOT NULL REFERENCES DimTiempo(KeyTiempo),
  KeyPrograma   INT NOT NULL REFERENCES DimProgramaAcademico(KeyPrograma),
  PuntajeSWLS   INT NULL                      -- 5 a 35
);
CREATE TABLE Hecho_Interaccion (
  KeyEstudiante       INT NOT NULL REFERENCES DimEstudiante(KeyEstudiante),
  KeyTiempo           INT NOT NULL REFERENCES DimTiempo(KeyTiempo),
  KeyPrograma         INT NOT NULL REFERENCES DimProgramaAcademico(KeyPrograma),
  KeyInteraccion      INT NOT NULL REFERENCES DimInteraccionSocial(KeyInteraccion),
  HorasSignificativas DECIMAL(18,2) NULL,
  ValoracionInteraccion DECIMAL(18,2) NULL
);
CREATE TABLE Hecho_Actividad (
  KeyEstudiante    INT NOT NULL REFERENCES DimEstudiante(KeyEstudiante),
  KeyTiempo        INT NOT NULL REFERENCES DimTiempo(KeyTiempo),
  KeyPrograma      INT NOT NULL REFERENCES DimProgramaAcademico(KeyPrograma),
  KeyActividad     INT NOT NULL REFERENCES DimActividad(KeyActividad),
  DiasActividad    INT NULL,                  -- NO ADITIVA: ver KPI-04
  MinutosActividad INT NULL
);
CREATE INDEX IX_HB ON Hecho_Bienestar(KeyEstudiante, KeyTiempo);
CREATE INDEX IX_HI ON Hecho_Interaccion(KeyEstudiante, KeyTiempo);
CREATE INDEX IX_HA ON Hecho_Actividad(KeyEstudiante, KeyTiempo);
GO

-- Auditoría (misma estructura, en el Mart, para que el ETL registre aquí)
CREATE TABLE AUDITORIA_ETL (
  id_run     INT IDENTITY(1,1) PRIMARY KEY,
  paso       VARCHAR(60)  NOT NULL,
  inicio     DATETIME2    NOT NULL DEFAULT SYSDATETIME(),
  fin        DATETIME2    NULL,
  leidas     INT          NULL,
  insertadas INT          NULL,
  rechazadas INT          NULL,
  estado     VARCHAR(12)  NOT NULL DEFAULT 'EN CURSO',
  mensaje    VARCHAR(500) NULL
);
GO

