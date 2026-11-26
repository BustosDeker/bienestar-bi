/* 06 - Usuarios de la base de datos con minimos privilegios (cambiar contrasenas fuera del desarrollo local)
   bienestar_api : SELECT en el Mart y en el OLTP (incluye USUARIO para autenticar);
                   INSERT solo en las tablas de registro del OLTP. Sin acceso a AUDITORIA_ETL del OLTP.
   bienestar_etl : ejecuta usp_ETL_* (lee el OLTP, escribe el Mart y AUDITORIA_ETL). */
USE master;
GO
IF SUSER_ID('bienestar_api') IS NULL CREATE LOGIN bienestar_api WITH PASSWORD = 'Api#Bienestar2026', CHECK_POLICY = OFF;
IF SUSER_ID('bienestar_etl') IS NULL CREATE LOGIN bienestar_etl WITH PASSWORD = 'Etl#Bienestar2026', CHECK_POLICY = OFF;
GO
USE BienestarOLTP;
GO
CREATE USER bienestar_api FOR LOGIN bienestar_api;
CREATE USER bienestar_etl FOR LOGIN bienestar_etl;
GRANT SELECT ON SCHEMA::dbo TO bienestar_api;
DENY  SELECT ON dbo.AUDITORIA_ETL TO bienestar_api;
GRANT INSERT ON dbo.ENCUESTA_BIENESTAR   TO bienestar_api;
GRANT INSERT ON dbo.RESPUESTA_SWLS       TO bienestar_api;
GRANT INSERT ON dbo.REGISTRO_INTERACCION TO bienestar_api;
GRANT INSERT ON dbo.REGISTRO_ACTIVIDAD   TO bienestar_api;
ALTER ROLE db_datareader ADD MEMBER bienestar_etl;
GO
USE Mart_Bienestar;
GO
CREATE USER bienestar_api FOR LOGIN bienestar_api;
CREATE USER bienestar_etl FOR LOGIN bienestar_etl;
GRANT SELECT ON SCHEMA::dbo TO bienestar_api;
ALTER ROLE db_owner ADD MEMBER bienestar_etl;
GO
