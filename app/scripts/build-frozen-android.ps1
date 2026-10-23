[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$frozenApp = Split-Path $PSScriptRoot -Parent
function Invoke-FrozenCommand([string]$File,[string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Frozen UI command failed: $File" }
}
Push-Location $frozenApp
$frozenNames = @('JAVA_HOME','ANDROID_HOME','SLM_FROZEN_UI_ANDROID')
$frozenSaved = @{}
foreach ($frozenName in $frozenNames) { $frozenSaved[$frozenName] = [Environment]::GetEnvironmentVariable($frozenName,'Process') }
try {
    if ((& git branch --show-current).Trim() -ne 'feat/slm-v1-live') { throw 'Requires feat/slm-v1-live' }
    $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
    $env:SLM_FROZEN_UI_ANDROID = '1'
    Invoke-FrozenCommand 'node' @('scripts/verify-frozen-ui.mjs')
    Invoke-FrozenCommand 'npm.cmd' @('run','build:demo')
    Invoke-FrozenCommand 'npx.cmd' @('cap','sync','android')
    Invoke-FrozenCommand '.\android\gradlew.bat' @('-p','android',':app:assembleDebug',':app:testDebugUnitTest')
    Invoke-FrozenCommand 'python' @('scripts/verify-frozen-apk.py')
} finally {
    foreach ($frozenName in $frozenNames) { [Environment]::SetEnvironmentVariable($frozenName,$frozenSaved[$frozenName],'Process') }
    Pop-Location
}
