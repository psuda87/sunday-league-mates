[CmdletBinding()]
param([ValidateSet('ui','live')][string]$Mode='ui', [switch]$Assemble, [switch]$Open, [switch]$CheckOnly)
$ErrorActionPreference='Stop'
$workflowApp=Split-Path $PSScriptRoot -Parent
function Invoke-Workflow([string]$File,[string[]]$Arguments) {
  $ErrorActionPreference='Continue'
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $File" }
}
$workflowSavedJava=$env:JAVA_HOME
$workflowSavedSdk=$env:ANDROID_HOME
Push-Location $workflowApp
try {
  if ($CheckOnly) {
    if ($Assemble -or $Open) { throw 'CheckOnly cannot install, build or open the IDE' }
    Invoke-Workflow 'node' @('scripts/android-studio-state.mjs')
    return
  }
  Invoke-Workflow 'node' @('scripts/android-studio-prepare.mjs',$Mode)
  if ($Assemble) {
    $workflowJbr=Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
    if (!(Test-Path -LiteralPath "$workflowJbr\bin\java.exe")) { throw 'Android Studio JBR not found; select an existing JDK21+ explicitly' }
    $env:JAVA_HOME=$workflowJbr
    if (!$env:ANDROID_HOME) { $env:ANDROID_HOME=Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
    if (!(Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'Existing Android SDK not found' }
    Invoke-Workflow '.\android\gradlew.bat' @('-p','android',':app:assembleDebug','--offline')
    Get-FileHash -LiteralPath 'android\app\build\outputs\apk\debug\app-debug.apk' -Algorithm SHA256
  }
  if ($Open) {
    $workflowStudio=Join-Path $env:ProgramFiles 'Android\Android Studio\bin\studio64.exe'
    if (!(Test-Path -LiteralPath $workflowStudio)) { throw 'Android Studio executable not found' }
    # An interactive IDE window is intentional when the owner chooses -Open.
    Start-Process -FilePath $workflowStudio -ArgumentList ('"'+(Join-Path $workflowApp 'android')+'"')
  }
} finally {
  $env:JAVA_HOME=$workflowSavedJava
  $env:ANDROID_HOME=$workflowSavedSdk
  Pop-Location
}
