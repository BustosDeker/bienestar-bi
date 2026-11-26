#!/bin/bash
# Ejecuta los scripts de Datos/ en orden. Idempotente: si BienestarOLTP ya existe con tablas, no recrea.
set -e
SQL="/opt/mssql-tools18/bin/sqlcmd -C -S db -U sa -b -f 65001 -I"
if $SQL -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID('BienestarOLTP') IS NOT NULL AND EXISTS (SELECT 1 FROM BienestarOLTP.sys.tables WHERE name='ESTUDIANTE') THEN 'SI' ELSE 'NO' END" | grep -q SI; then
  echo "Bases ya inicializadas; para reiniciar: docker compose down -v"; exit 0
fi
for f in 01_oltp_create 02_seed_oltp 03_mart_create 04_etl_procedures 04b_etl_app 06_security; do
  echo ">> $f.sql"; $SQL -i /datos/$f.sql
done
echo ">> ETL inicial"; $SQL -Q "EXEC Mart_Bienestar.dbo.usp_ETL_Completo"
echo "Listo."
