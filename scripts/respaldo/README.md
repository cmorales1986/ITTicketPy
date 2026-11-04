# Respaldo de la base de ITTicketPy (PR-INF-01 / FL-INF-03)

La base de ITTicketPy vive en Neon (Postgres). Neon solo conserva 6 horas de
historial para restaurar, así que el respaldo diario se hace a un servidor
propio con `respaldo-itticketpy.ps1`. Ese servidor ya entra en los respaldos
de Veeam / SQL (PR-INF-01).

## Puesta en marcha (una vez, en el servidor Windows)

1. Instalar **PostgreSQL client tools 18 o superior** (solo `pg_dump` y
   `pg_restore`; no hace falta el servidor).
2. Guardar la cadena de conexión de Neon como variable de **sistema**
   (PowerShell como administrador). Es la misma `DATABASE_URL` de Vercel:

   ```powershell
   [Environment]::SetEnvironmentVariable('ITTICKETPY_DATABASE_URL', '<cadena de conexión>', 'Machine')
   ```

3. Copiar el script a `C:\scripts\` y probarlo a mano:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:\scripts\respaldo-itticketpy.ps1
   ```

   Debe crear un `.dump` en `D:\Respaldos\ITTicketPy` y una línea
   `Exitoso` en `registro-respaldos.csv`.
4. Programarlo de lunes a sábado (como pide el FL-INF-03):

   ```powershell
   schtasks /Create /TN "Respaldo ITTicketPy" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\scripts\respaldo-itticketpy.ps1" /SC WEEKLY /D MON,TUE,WED,THU,FRI,SAT /ST 22:00 /RU SYSTEM
   ```

Parámetros opcionales del script: `-Destino`, `-RetencionDias` (30 por defecto)
y `-PgBin`.

## Verificación diaria (FL-INF-03)

Cada día de respaldo, abrir `registro-respaldos.csv` y cargar en el FL-INF-03 una
fila con sistema **ITTicketPy (Neon)**, el resultado (`Exitoso` / `Error`) y,
si hubo error, la acción realizada. Hay que agregar "ITTicketPy (Neon)" como
cuarta opción de la lista de sistemas del formulario.

## Prueba de restauración

Un respaldo que nunca se restauró no es evidencia. Al menos una vez al mes,
restaurar el último `.dump` en una base de pruebas y comprobar que la cantidad
de tickets coincide:

```powershell
createdb prueba_itticketpy
pg_restore --no-owner --dbname=prueba_itticketpy D:\Respaldos\ITTicketPy\<archivo>.dump
psql prueba_itticketpy -c "select count(*) from tickets"
```
