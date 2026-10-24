[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$b1App=Split-Path $PSScriptRoot -Parent
function Invoke-B1([string]$File,[string[]]$Arguments){ & $File @Arguments; if($LASTEXITCODE -ne 0){throw "B1 command failed: $File"} }
Push-Location $b1App
$b1Names=@('JAVA_HOME','ANDROID_HOME','SLM_B1_ANDROID','SLM_FROZEN_UI_ANDROID')
$b1Saved=@{}
foreach($b1Name in $b1Names){$b1Saved[$b1Name]=[Environment]::GetEnvironmentVariable($b1Name,'Process')}
try {
 if((& git branch --show-current).Trim() -ne 'feat/slm-v1-live'){throw 'Requires feat/slm-v1-live'}
 $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
 if(-not $env:ANDROID_HOME){$env:ANDROID_HOME=Join-Path $env:LOCALAPPDATA 'Android\Sdk'}
 $env:SLM_B1_ANDROID='1';$env:SLM_FROZEN_UI_ANDROID=$null
 Invoke-B1 'node' @('scripts/verify-frozen-ui.mjs')
 Invoke-B1 'npx.cmd' @('tsc','--noEmit')
 Invoke-B1 'npx.cmd' @('vite','build','--config','vite.b1.config.ts')
 Invoke-B1 'npx.cmd' @('cap','sync','android')
 Invoke-B1 '.\android\gradlew.bat' @('-p','android',':app:assembleDebug',':app:testDebugUnitTest')
 Invoke-B1 'python' @('scripts/verify-b1-apk.py')
} finally {
 foreach($b1Name in $b1Names){[Environment]::SetEnvironmentVariable($b1Name,$b1Saved[$b1Name],'Process')}
 Pop-Location
}
