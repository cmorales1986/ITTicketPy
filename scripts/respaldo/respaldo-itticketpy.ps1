<#
Respaldo diario de la base de datos de ITTicketPy (Postgres en Neon).
Procedimiento PR-INF-01 / registro FL-INF-03.

Qué hace:
  1. Exporta la base completa con pg_dump (formato custom, comprimido).
  2. Verifica el archivo: que no esté vacío y que pg_restore pueda leerlo.
  3. Anota el resultado en registro-respaldos.csv (Fecha, Sistema, Resultado,
     Detalle) para cargar luego en el FL-INF-03.
  4. Borra los respaldos con más de N días, pero solo si el de hoy salió bien.

Requisitos en el servidor:
  - PostgreSQL client tools versión 18 o superior (pg_dump y pg_restore).
    La base de Neon es Postgres 18: un pg_dump más viejo se niega a exportarla.
  - Variable de entorno de sistema ITTICKETPY_DATABASE_URL con la cadena de
    conexión de Neon (la misma DATABASE_URL de Vercel). No va en este archivo.
  - Salida a internet hacia Neon (puerto 5432).

Código de salida: 0 = exitoso, 1 = error.
#>
param(
  [string]$Destino = 'D:\Respaldos\ITTicketPy',
  [int]$RetencionDias = 30,
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin'
)

$ErrorActionPreference = 'Stop'
$sistema = 'ITTicketPy (Neon)'
$registro = Join-Path $Destino 'registro-respaldos.csv'

function Anotar([string]$resultado, [string]$detalle) {
  if (-not (Test-Path $registro)) {
    'Fecha,Sistema,Resultado,Detalle' | Out-File $registro -Encoding utf8
  }
  $fecha = Get-Date -Format 'yyyy-MM-dd HH:mm'
  $detalle = $detalle -replace '[\r\n,]+', ' '
  "$fecha,$sistema,$resultado,$detalle" | Out-File $registro -Append -Encoding utf8
}

try {
  New-Item -ItemType Directory -Force -Path $Destino | Out-Null

  $conn = [Environment]::GetEnvironmentVariable('ITTICKETPY_DATABASE_URL', 'Machine')
  if (-not $conn) { throw 'Falta la variable de entorno de sistema ITTICKETPY_DATABASE_URL' }

  $pgDump = Join-Path $PgBin 'pg_dump.exe'
  $pgRestore = Join-Path $PgBin 'pg_restore.exe'
  foreach ($exe in @($pgDump, $pgRestore)) {
    if (-not (Test-Path $exe)) { throw "No se encuentra $exe (instalar PostgreSQL client tools 18 o superior)" }
  }

  $archivo = Join-Path $Destino ('itticketpy_{0}.dump' -f (Get-Date -Format 'yyyyMMdd_HHmm'))

  # La cadena de conexión viaja como argumento pero no se escribe en ningún log.
  & $pgDump --dbname=$conn --format=custom --no-owner --file=$archivo 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "pg_dump terminó con código $LASTEXITCODE" }

  $tam = (Get-Item $archivo).Length
  if ($tam -lt 10KB) { throw "El respaldo pesa solo $tam bytes: parece incompleto" }

  # Verificación: pg_restore tiene que poder listar el contenido.
  & $pgRestore --list $archivo 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore no pudo leer el respaldo generado' }

  # Retención: solo se limpia si el respaldo de hoy salió bien.
  Get-ChildItem $Destino -Filter 'itticketpy_*.dump' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetencionDias) } |
    Remove-Item -Force

  Anotar 'Exitoso' ('{0} ({1:N1} MB)' -f (Split-Path $archivo -Leaf), ($tam / 1MB))
  exit 0
}
catch {
  Anotar 'Error' $_.Exception.Message
  exit 1
}
