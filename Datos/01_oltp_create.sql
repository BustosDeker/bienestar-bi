/* 01 - BienestarOLTP: bases, DDL, constraints, indices, catalogos, auditoria (PARTE A y B del script base) */

IF DB_ID('BienestarOLTP')   IS NULL CREATE DATABASE BienestarOLTP;
GO
IF DB_ID('Mart_Bienestar')  IS NULL CREATE DATABASE Mart_Bienestar;
GO



USE BienestarOLTP;
GO

CREATE TABLE FACULTAD (
  id_facultad INT IDENTITY(1,1) PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE ESCUELA (
  id_escuela  INT IDENTITY(1,1) PRIMARY KEY,
  id_facultad INT NOT NULL REFERENCES FACULTAD(id_facultad),
  nombre      VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE RANGO_INGRESO (
  id_rango    INT IDENTITY(1,1) PRIMARY KEY,
  descripcion VARCHAR(60) NOT NULL UNIQUE      -- incluye 'No informa'
);
CREATE TABLE ESTUDIANTE (
  cod_estudiante   INT PRIMARY KEY,            -- código seudonimizado
  id_escuela       INT NOT NULL REFERENCES ESCUELA(id_escuela),
  id_rango         INT NULL REFERENCES RANGO_INGRESO(id_rango),
  sexo             CHAR(1) NOT NULL CHECK (sexo IN ('F','M')),
  fecha_nacimiento DATE NOT NULL
);
CREATE TABLE PERIODO_ACADEMICO (
  id_periodo   INT IDENTITY(1,1) PRIMARY KEY,
  codigo       VARCHAR(10) NOT NULL UNIQUE,    -- p. ej. 2026-II
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  CHECK (fecha_fin > fecha_inicio)
);
CREATE TABLE MATRICULA (
  id_matricula   INT IDENTITY(1,1) PRIMARY KEY,
  cod_estudiante INT NOT NULL REFERENCES ESTUDIANTE(cod_estudiante),
  id_periodo     INT NOT NULL REFERENCES PERIODO_ACADEMICO(id_periodo),
  ciclo          INT NOT NULL CHECK (ciclo BETWEEN 1 AND 10),
  CONSTRAINT UQ_MATRICULA UNIQUE (cod_estudiante, id_periodo)
);
CREATE TABLE OLA_MEDICION (
  id_ola       INT IDENTITY(1,1) PRIMARY KEY,
  id_periodo   INT NOT NULL REFERENCES PERIODO_ACADEMICO(id_periodo),
  numero       INT NOT NULL CHECK (numero BETWEEN 1 AND 3),
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT UQ_OLA UNIQUE (id_periodo, numero)
);
CREATE TABLE ENCUESTA_BIENESTAR (
  id_encuesta      INT IDENTITY(1,1) PRIMARY KEY,
  cod_estudiante   INT NOT NULL REFERENCES ESTUDIANTE(cod_estudiante),
  id_ola           INT NOT NULL REFERENCES OLA_MEDICION(id_ola),
  fecha_aplicacion DATE NOT NULL,
  CONSTRAINT UQ_ENCUESTA UNIQUE (cod_estudiante, id_ola)   -- una encuesta por ola
);
CREATE TABLE ITEM_SWLS (
  id_item   INT IDENTITY(1,1) PRIMARY KEY,
  numero    INT NOT NULL UNIQUE CHECK (numero BETWEEN 1 AND 5),
  enunciado VARCHAR(250) NOT NULL
);
CREATE TABLE RESPUESTA_SWLS (
  id_encuesta INT NOT NULL REFERENCES ENCUESTA_BIENESTAR(id_encuesta),
  id_item     INT NOT NULL REFERENCES ITEM_SWLS(id_item),
  valor       INT NOT NULL CHECK (valor BETWEEN 1 AND 7),
  CONSTRAINT PK_RESPUESTA_SWLS PRIMARY KEY (id_encuesta, id_item)
);
CREATE TABLE TIPO_VINCULO (
  id_vinculo INT IDENTITY(1,1) PRIMARY KEY,
  nombre     VARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE MODALIDAD (
  id_modalidad INT IDENTITY(1,1) PRIMARY KEY,
  nombre       VARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE TIPO_INTERACCION (
  id_tipo_inter INT IDENTITY(1,1) PRIMARY KEY,
  id_vinculo    INT NOT NULL REFERENCES TIPO_VINCULO(id_vinculo),
  id_modalidad  INT NOT NULL REFERENCES MODALIDAD(id_modalidad),
  descripcion   VARCHAR(100) NOT NULL,
  CONSTRAINT UQ_TIPO_INTER UNIQUE (id_vinculo, id_modalidad)
);
CREATE TABLE REGISTRO_INTERACCION (
  id_registro    INT IDENTITY(1,1) PRIMARY KEY,
  cod_estudiante INT NOT NULL REFERENCES ESTUDIANTE(cod_estudiante),
  id_tipo_inter  INT NOT NULL REFERENCES TIPO_INTERACCION(id_tipo_inter),
  fecha          DATE NOT NULL,
  duracion_horas DECIMAL(5,2) NOT NULL CHECK (duracion_horas > 0 AND duracion_horas <= 24),
  valoracion     TINYINT NOT NULL CHECK (valoracion BETWEEN 1 AND 5)
);
CREATE TABLE INTENSIDAD (
  id_intensidad INT IDENTITY(1,1) PRIMARY KEY,
  nombre        VARCHAR(30) NOT NULL UNIQUE      -- leve, moderada, vigorosa
);
CREATE TABLE TIPO_ACTIVIDAD (
  id_tipo_act INT IDENTITY(1,1) PRIMARY KEY,
  nombre      VARCHAR(50) NOT NULL UNIQUE        -- actividad física, autocuidado
);
CREATE TABLE ACTIVIDAD (
  id_actividad  INT IDENTITY(1,1) PRIMARY KEY,
  id_tipo_act   INT NOT NULL REFERENCES TIPO_ACTIVIDAD(id_tipo_act),
  id_intensidad INT NOT NULL REFERENCES INTENSIDAD(id_intensidad),
  nombre        VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE REGISTRO_ACTIVIDAD (
  id_registro    INT IDENTITY(1,1) PRIMARY KEY,
  cod_estudiante INT NOT NULL REFERENCES ESTUDIANTE(cod_estudiante),
  id_actividad   INT NOT NULL REFERENCES ACTIVIDAD(id_actividad),
  fecha          DATE NOT NULL,
  duracion_min   INT NOT NULL CHECK (duracion_min > 0 AND duracion_min <= 600)
);
GO

-- Autenticación de la aplicación (no es parte del modelo del informe): una cuenta por usuario.
CREATE TABLE USUARIO (
  id_usuario     INT IDENTITY(1,1) PRIMARY KEY,
  username       VARCHAR(50)  NOT NULL UNIQUE,
  password_hash  VARCHAR(200) NOT NULL,              -- scrypt$N$r$p$sal(b64)$hash(b64)
  rol            VARCHAR(12)  NOT NULL CHECK (rol IN ('estudiante','bienestar')),
  cod_estudiante INT NULL REFERENCES ESTUDIANTE(cod_estudiante),
  activo         BIT NOT NULL DEFAULT 1,
  CHECK ((rol = 'estudiante' AND cod_estudiante IS NOT NULL) OR (rol = 'bienestar' AND cod_estudiante IS NULL))
);
GO

-- Índices en claves foráneas y fechas
CREATE INDEX IX_ESTUDIANTE_escuela   ON ESTUDIANTE(id_escuela);
CREATE INDEX IX_MATRICULA_est        ON MATRICULA(cod_estudiante);
CREATE INDEX IX_ENCUESTA_est_ola     ON ENCUESTA_BIENESTAR(cod_estudiante, id_ola);
CREATE INDEX IX_REG_INTER_est_fecha  ON REGISTRO_INTERACCION(cod_estudiante, fecha);
CREATE INDEX IX_REG_ACT_est_fecha    ON REGISTRO_ACTIVIDAD(cod_estudiante, fecha);
GO

-- Configuración de umbrales del semáforo (no se escriben en el código de la app)
CREATE TABLE CONFIG_KPI (
  kpi        VARCHAR(10) PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  umbral_bueno   DECIMAL(6,2) NOT NULL,    -- >= bueno
  umbral_regular DECIMAL(6,2) NOT NULL     -- >= regular y < bueno ; < regular = malo
);
INSERT INTO CONFIG_KPI VALUES
 ('KPI-01','Nivel de satisfacción con la vida',26,20),
 ('KPI-02','Horas semanales de interacción social significativa',10,5),
 ('KPI-03','Índice de calidad relacional',4,3),
 ('KPI-04','Días semanales de actividad física',3,1);
GO

-- Catálogos base
INSERT INTO FACULTAD(nombre) VALUES ('Ingeniería'),('Ciencias Sociales');
INSERT INTO ESCUELA(id_facultad,nombre) VALUES
 (1,'Ing. de Sistemas'),(1,'Ing. Industrial'),(1,'Ing. Civil'),
 (2,'Psicología'),(2,'Educación');
INSERT INTO RANGO_INGRESO(descripcion) VALUES ('Bajo'),('Medio'),('Alto'),('No informa');
INSERT INTO ITEM_SWLS(numero,enunciado) VALUES
 (1,'En la mayoría de los aspectos, mi vida se acerca a mi ideal.'),
 (2,'Las condiciones de mi vida son excelentes.'),
 (3,'Estoy satisfecho con mi vida.'),
 (4,'Hasta ahora he conseguido las cosas importantes que quiero en la vida.'),
 (5,'Si pudiera vivir mi vida de nuevo, no cambiaría casi nada.');
INSERT INTO TIPO_VINCULO(nombre) VALUES ('Familia'),('Pareja'),('Amistades'),('Compañeros de estudio');
INSERT INTO MODALIDAD(nombre) VALUES ('Presencial'),('Virtual');
INSERT INTO TIPO_INTERACCION(id_vinculo,id_modalidad,descripcion)
SELECT v.id_vinculo, m.id_modalidad, v.nombre + ' (' + LOWER(m.nombre) + ')'
FROM TIPO_VINCULO v CROSS JOIN MODALIDAD m;
INSERT INTO INTENSIDAD(nombre) VALUES ('Leve'),('Moderada'),('Vigorosa');
INSERT INTO TIPO_ACTIVIDAD(nombre) VALUES ('Actividad física'),('Autocuidado');
INSERT INTO ACTIVIDAD(id_tipo_act,id_intensidad,nombre) VALUES
 (1,1,'Caminata'),(1,2,'Trote'),(1,3,'Deporte colectivo'),(1,3,'Gimnasio'),
 (2,1,'Yoga o estiramiento'),(2,1,'Meditación o respiración');
INSERT INTO PERIODO_ACADEMICO(codigo,fecha_inicio,fecha_fin) VALUES ('2026-II','2026-08-17','2026-12-18');
INSERT INTO OLA_MEDICION(id_periodo,numero,fecha_inicio,fecha_fin) VALUES
 (1,1,'2026-08-17','2026-08-30'),
 (1,2,'2026-10-05','2026-10-18'),
 (1,3,'2026-12-01','2026-12-14');
GO

-- Auditoría del ETL
CREATE TABLE AUDITORIA_ETL (
  id_run     INT IDENTITY(1,1) PRIMARY KEY,
  paso       VARCHAR(60)  NOT NULL,
  inicio     DATETIME2    NOT NULL DEFAULT SYSDATETIME(),
  fin        DATETIME2    NULL,
  leidas     INT          NULL,
  insertadas INT          NULL,
  rechazadas INT          NULL,
  estado     VARCHAR(12)  NOT NULL DEFAULT 'EN CURSO',   -- EN CURSO / OK / ERROR
  mensaje    VARCHAR(500) NULL
);
GO

