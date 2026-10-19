# Interactive local fictional account; never use production bootstrap-admin.ps1.
[CmdletBinding()]
param([switch]$Check)
$ErrorActionPreference = 'Stop'
$fixtureSecret = $null; $fixtureRepeat = $null
$fixturePtr = [IntPtr]::Zero; $fixtureRepeatPtr = [IntPtr]::Zero
$fixturePassword = $null; $fixtureConfirmation = $null; $fixturePayload = $null
$fixtureOutputEncoding = $OutputEncoding
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    & node (Join-Path $PSScriptRoot 'android-phone-fixture.mjs') --check
    if ($LASTEXITCODE -ne 0) { throw 'Local fixture preflight failed' }
    if (-not $Check) {
        Write-Host 'LOCAL ONLY: http://127.0.0.1:54321; no SMTP/SMS; no global administrator.'
        $fixtureEmail = Read-Host 'Fictional email (e.g. phone-owner@phone-fixture.invalid)'
        if ($fixtureEmail -cnotmatch '^[a-z0-9][a-z0-9._-]{0,48}@phone-fixture\.invalid$') { throw 'Only the fictional phone-fixture.invalid domain is allowed' }
        $fixtureSecret = Read-Host 'Password (8 characters minimum, 72 UTF-8 bytes maximum)' -AsSecureString
        $fixtureRepeat = Read-Host 'Repeat password' -AsSecureString
        $fixturePtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($fixtureSecret)
        $fixtureRepeatPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($fixtureRepeat)
        $fixturePassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($fixturePtr)
        $fixtureConfirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($fixtureRepeatPtr)
        if ($fixturePassword -cne $fixtureConfirmation) { throw 'Passwords differ' }
        if ($fixturePassword.Length -lt 8 -or [Text.Encoding]::UTF8.GetByteCount($fixturePassword) -gt 72) { throw 'Password policy rejected' }
        $fixturePayload = @{email=$fixtureEmail;password=$fixturePassword} | ConvertTo-Json -Compress
        $fixturePayload | & node (Join-Path $PSScriptRoot 'android-phone-fixture.mjs') --stdin
        if ($LASTEXITCODE -ne 0) { throw 'Local fixture creation failed; do not change existing accounts' }
    }
} finally {
    if ($fixturePtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($fixturePtr) }
    if ($fixtureRepeatPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($fixtureRepeatPtr) }
    if ($fixtureSecret) { $fixtureSecret.Dispose() }
    if ($fixtureRepeat) { $fixtureRepeat.Dispose() }
    $fixturePassword=$null; $fixtureConfirmation=$null; $fixturePayload=$null
    $OutputEncoding = $fixtureOutputEncoding
    Pop-Location
}
