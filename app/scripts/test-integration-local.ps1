# Wyłącznie izolowany LOCAL Supabase. Nigdy nie czyta .env, PAT ani zdalnego DSN.
param([switch]$RunSql)
$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if ((git -C $repo branch --show-current) -ne 'feat/integration') { throw 'Wymagany feat/integration.' }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Brak docker.exe; zainstaluj i uruchom Docker Desktop. Nie używaj zdalnej bazy.' }
$local = Join-Path $repo '.cache/supabase-integration'
$configPath = Join-Path $local 'supabase/config.toml'
if (-not (Test-Path $configPath)) {
 New-Item -ItemType Directory -Force -Path $local | Out-Null
 & npx --yes --package=supabase@2.121.0 supabase init --workdir $local
 if ($LASTEXITCODE -ne 0) { throw 'Nie udało się init lokalnego Supabase.' }
}
$config = [IO.File]::ReadAllText($configPath)
$config = [regex]::Replace($config,'(?m)^project_id = .*$', 'project_id = "slm-integration-isolated"')
$config = [regex]::Replace($config,'(?m)^enable_signup = true$', 'enable_signup = false')
[IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false))
$migrations = Join-Path $local 'supabase/migrations'
New-Item -ItemType Directory -Force -Path $migrations | Out-Null
Get-ChildItem -LiteralPath (Join-Path $repo 'app/supabase/migrations') -Filter '*.sql' | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $migrations -Force }
# CLI może wypisać klucze lokalne: pełny output pozostaje wyłącznie w pamięci.
$result = & npx --yes --package=supabase@2.121.0 supabase start --workdir $local 2>&1
if ($LASTEXITCODE -ne 0) { throw 'Start lokalnego Supabase nie powiódł się; sprawdź Docker Desktop i zajęte porty. Pełny output celowo ukryty.' }
Write-Output 'Izolowany Supabase wystartował; klucze nie zostały wypisane.'
if ($RunSql) {
 foreach ($file in @('settlements.sql','notifications.sql','integration-contracts.sql')) {
  Get-Content -Raw -Encoding utf8 (Join-Path $repo "app/supabase/tests/$file") |
    docker exec -i supabase_db_slm-integration-isolated psql -X -U postgres -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "Lokalny SQL nie przeszedł: $file" }
 }
}
