# Local preparation only. Run from PowerShell; no secrets in command arguments.
[CmdletBinding()]
param(
    [ValidateSet('Check','Backend','Build','Install','Logs','Disconnect')]
    [string]$Action = 'Check',
    [string]$Serial
)
$ErrorActionPreference = 'Stop'
$phoneRepo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$phoneApp = Join-Path $phoneRepo 'app'
$phoneHelper = Join-Path $PSScriptRoot 'android-phone-local.py'
$phoneSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$phoneAdb = Join-Path $phoneSdk 'platform-tools\adb.exe'
$phoneApk = Join-Path $phoneApp 'android\app\build\outputs\apk\debug\app-debug.apk'
function Invoke-PhoneCommand {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Local command failed: $File (exit $LASTEXITCODE)" }
}
function Resolve-PhoneDevice {
    $phoneDevices = @(& $phoneAdb devices)
    if ($LASTEXITCODE -ne 0) { throw 'ADB devices failed' }
    $phoneReady = @($phoneDevices | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
    if ($Serial) {
        if ($phoneReady -notcontains $Serial) { throw 'Selected device is not authorized/connected' }
        return $Serial
    }
    if ($phoneReady.Count -ne 1) { throw 'Connect and authorize exactly one phone, or pass -Serial. No device was changed.' }
    return $phoneReady[0]
}
Push-Location $phoneApp
try {
    $phoneBranch = (& git branch --show-current).Trim()
    if ($phoneBranch -notin @('feat/integration','chore/android-phone-readiness','feat/premium318-live','feat/premium319-android','feat/premium320-visual-parity')) { throw 'Requires an approved local integration/readiness branch; no automatic checkout' }
    if (-not (Test-Path -LiteralPath $phoneAdb)) { throw "Missing Android platform-tools: $phoneAdb" }
    switch ($Action) {
        'Check' {
            Invoke-PhoneCommand 'python' @($phoneHelper,'check')
            Invoke-PhoneCommand $phoneAdb @('version')
            Invoke-PhoneCommand $phoneAdb @('devices','-l')
        }
        'Backend' { Invoke-PhoneCommand 'python' @($phoneHelper,'backend') }
        'Build' {
            $phoneEnvNames = @('JAVA_HOME','ANDROID_HOME','VITE_SLM_FUNCTION_URL','VITE_SLM_PUSH_ENABLED','SLM_LOCAL_ANDROID')
            $phoneSavedEnv = @{}
            foreach ($phoneName in $phoneEnvNames) { $phoneSavedEnv[$phoneName] = [Environment]::GetEnvironmentVariable($phoneName,'Process') }
            try {
                $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
                $env:ANDROID_HOME = $phoneSdk
                if (-not (Test-Path -LiteralPath "$env:JAVA_HOME\bin\java.exe")) { throw 'Android Studio JDK21 is missing' }
                $env:VITE_SLM_FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1/accounts'
                $env:VITE_SLM_PUSH_ENABLED = 'false'
                $env:SLM_LOCAL_ANDROID = '1'
                Invoke-PhoneCommand 'npm.cmd' @('run','build')
                Invoke-PhoneCommand 'npx.cmd' @('cap','sync','android')
                Invoke-PhoneCommand '.\android\gradlew.bat' @('-p','android',':app:assembleDebug',':app:testDebugUnitTest')
                Invoke-PhoneCommand 'python' @($phoneHelper,'verify-apk','--write-report')
                Invoke-PhoneCommand 'python' @($phoneHelper,'release-guard')
            } finally {
                foreach ($phoneName in $phoneEnvNames) { [Environment]::SetEnvironmentVariable($phoneName,$phoneSavedEnv[$phoneName],'Process') }
            }
        }
        'Install' {
            Invoke-PhoneCommand 'python' @($phoneHelper,'check')
            Invoke-PhoneCommand 'python' @($phoneHelper,'verify-apk')
            $phoneDevice = Resolve-PhoneDevice
            $phoneAbi = (& $phoneAdb -s $phoneDevice shell getprop ro.build.version.sdk).Trim()
            if ([int]$phoneAbi -lt 24) { throw 'Android 7/API24 or newer is required' }
            Invoke-PhoneCommand $phoneAdb @('-s',$phoneDevice,'reverse','tcp:54321','tcp:54321')
            Invoke-PhoneCommand $phoneAdb @('-s',$phoneDevice,'install','-r',$phoneApk)
            Invoke-PhoneCommand $phoneAdb @('-s',$phoneDevice,'shell','am','start','-n','pl.psuda87.slm/.MainActivity')
        }
        'Logs' {
            $phoneDevice = Resolve-PhoneDevice
            Invoke-PhoneCommand 'python' @($phoneHelper,'logs','--adb',$phoneAdb,'--serial',$phoneDevice)
        }
        'Disconnect' {
            $phoneDevice = Resolve-PhoneDevice
            Invoke-PhoneCommand $phoneAdb @('-s',$phoneDevice,'reverse','--remove','tcp:54321')
            Write-Host 'Removed only the SLM reverse mapping. No app or user data deleted.'
        }
    }
} finally { Pop-Location }
