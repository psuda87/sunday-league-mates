# Wyłącznie lokalna diagnostyka. Nie uruchamia usług ani nie odczytuje kluczy.
$ErrorActionPreference = 'Stop'
$authRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$authBranch = & git -C $authRepoRoot branch --show-current
if ($LASTEXITCODE -ne 0 -or $authBranch -ne 'feat/auth') {
    Write-Output 'BLOKADA: wymagany branch feat/auth.'
    exit 1
}

$authMissing = $false
$authDocker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $authDocker) {
    Write-Output 'BLOKADA: docker nie jest dostępny w PATH; wymagany runtime zgodny z Docker API.'
    $authMissing = $true
} else {
    # Nie drukujemy informacji o kontekstach ani surowych logów demona.
    & $authDocker.Source info --format '{{.ServerVersion}}' *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Output 'BLOKADA: klient Docker jest dostępny, ale silnik nie odpowiada na docker info.'
        $authMissing = $true
    } else {
        Write-Output 'OK: silnik Docker odpowiada.'
    }
}

$authCli = Get-Command supabase -ErrorAction SilentlyContinue
$authLocalCli = Join-Path $authRepoRoot 'app/node_modules/.bin/supabase.cmd'
if (-not $authCli -and -not (Test-Path -LiteralPath $authLocalCli)) {
    Write-Output 'BLOKADA: brak Supabase CLI w PATH i app/node_modules/.bin/supabase.cmd.'
    $authMissing = $true
} else {
    Write-Output 'OK: znaleziono Supabase CLI.'
}

if ($authMissing) { exit 1 }
Write-Output 'OK: wymagania wstępne dostępne. To nie jest wynik testów Auth.'
exit 0
