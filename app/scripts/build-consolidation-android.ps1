[CmdletBinding()]
param([ValidateSet('live','premium')][string]$Variant='live')
$ErrorActionPreference='Stop'
$consolidationApp=Split-Path $PSScriptRoot -Parent
function Invoke-Consolidation([string]$File,[string[]]$Arguments){
 # Windows PowerShell can treat redirected native warnings as ErrorRecords.
 # The process exit code, rather than stderr alone, determines build failure.
 $ErrorActionPreference='Continue'
 & $File @Arguments
 if($LASTEXITCODE -ne 0){throw "Consolidation command failed: $File"}
}
Push-Location $consolidationApp
$consolidationNames=@('JAVA_HOME','ANDROID_HOME','SLM_B1_ANDROID','SLM_V1_LIVE_LOCAL','SLM_LOCAL_ANDROID')
$consolidationSaved=@{}
foreach($name in $consolidationNames){$consolidationSaved[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
try {
 if((& git branch --show-current).Trim() -notin @('feat/v1-consolidation','feat/premium-b3-groups')){throw 'Requires reviewed consolidation/B3 branch'}
 $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
 if(-not $env:ANDROID_HOME){$env:ANDROID_HOME=Join-Path $env:LOCALAPPDATA 'Android\Sdk'}
 $env:SLM_LOCAL_ANDROID='1'
 $env:SLM_B1_ANDROID=if($Variant -eq 'premium'){'1'}else{$null}
 $env:SLM_V1_LIVE_LOCAL=if($Variant -eq 'live'){'1'}else{$null}
 Invoke-Consolidation 'node' @('scripts/verify-consolidation.mjs')
 Invoke-Consolidation 'node' @('scripts/verify-frozen-ui.mjs')
 $buildScript=if($Variant -eq 'premium'){'build:premium-local'}else{'build:live-local'}
 Invoke-Consolidation 'npm.cmd' @('run',$buildScript)
 Invoke-Consolidation 'npx.cmd' @('cap','sync','android')
 # Capacitor resolves dependency junctions to another worktree. Keep portable paths.
 $settingsPath=Join-Path $consolidationApp 'android\capacitor.settings.gradle'
 $settings=[IO.File]::ReadAllText($settingsPath)
 $settings=[regex]::Replace($settings,"new File\('[^']*node_modules/","new File('../node_modules/")
 [IO.File]::WriteAllText($settingsPath,$settings,[Text.UTF8Encoding]::new($false))
 Invoke-Consolidation '.\android\gradlew.bat' @('-p','android',':app:assembleDebug',':app:testDebugUnitTest')
 Invoke-Consolidation 'python' @('scripts/verify-consolidation-apk.py',$Variant)
 $artifactFolder=Join-Path (Split-Path $consolidationApp -Parent) '.cache\consolidation'
 New-Item -ItemType Directory -Force -Path $artifactFolder | Out-Null
 Copy-Item -LiteralPath 'android\app\build\outputs\apk\debug\app-debug.apk' -Destination (Join-Path $artifactFolder ($Variant+'-debug.apk'))
} finally {
 foreach($name in $consolidationNames){[Environment]::SetEnvironmentVariable($name,$consolidationSaved[$name],'Process')}
 Pop-Location
}
