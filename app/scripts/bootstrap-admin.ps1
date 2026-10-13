# Uruchamiaj lokalnie w terminalu PowerShell. Hasło nie jest parametrem ani plikiem.
[CmdletBinding()]
param([switch]$Check)
$ErrorActionPreference = 'Stop'
$authBootstrapNode = Join-Path $PSScriptRoot 'bootstrap-admin.mjs'
$authBootstrapEncoding = $OutputEncoding
$authBootstrapConsoleEncoding = [Console]::OutputEncoding
$authBootstrapSecret = $null
$authBootstrapRepeat = $null
$authBootstrapPtr = [IntPtr]::Zero
$authBootstrapRepeatPtr = [IntPtr]::Zero
$authBootstrapPayload = $null
$authBootstrapPassword = $null
$authBootstrapConfirmationPassword = $null
$authBootstrapExit = 1
try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    & node $authBootstrapNode --check
    if ($LASTEXITCODE -ne 0) { throw 'Preflight odrzucony' }
    if ($Check) { $authBootstrapExit = 0 }
    else {
        Write-Host 'Projekt: hjtcyybkxebvdropchac. Tworzenie pierwszego administratora.'
        $authBootstrapLogin = Read-Host 'Login/pseudonim'
        $authBootstrapPhone = Read-Host 'Telefon z prefiksem kraju (np. +48)'
        $authBootstrapSecret = Read-Host 'Hasło tymczasowe (min. 8 znaków, do 72 bajtów)' -AsSecureString
        $authBootstrapRepeat = Read-Host 'Powtórz hasło tymczasowe' -AsSecureString
        $authBootstrapPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($authBootstrapSecret)
        $authBootstrapRepeatPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($authBootstrapRepeat)
        $authBootstrapPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($authBootstrapPtr)
        $authBootstrapConfirmationPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($authBootstrapRepeatPtr)
        if ($authBootstrapPassword -cne $authBootstrapConfirmationPassword) {
            Write-Host 'BLOKADA: hasła nie są identyczne.'
            throw 'Różne hasła'
        }
        $authBootstrapConfirm = Read-Host 'Aby utworzyć konto, wpisz CREATE_FIRST_ADMIN (Enter bez tekstu anuluje)'
        if ($authBootstrapConfirm -cne 'CREATE_FIRST_ADMIN') {
            Write-Host 'Anulowano. Konto nie zostało utworzone.'
            $authBootstrapExit = 0
        } else {
            $authBootstrapPayload = @{
                login = $authBootstrapLogin
                phone = $authBootstrapPhone
                password = $authBootstrapPassword
                confirm = $authBootstrapConfirm
            } | ConvertTo-Json -Compress
            # Pipeline jest stdin procesu, a nie wyjściem konsoli/plikiem/argumentem.
            $authBootstrapPayload | & node $authBootstrapNode --stdin
            $authBootstrapExit = $LASTEXITCODE
        }
    }
} catch {
    Write-Host 'Nie zakończono bootstrap. Nie ponawiaj bez sprawdzenia stanu projektu. Konto można utworzyć wyłącznie na feat/auth.'
} finally {
    if ($authBootstrapPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($authBootstrapPtr) }
    if ($authBootstrapRepeatPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($authBootstrapRepeatPtr) }
    if ($null -ne $authBootstrapSecret) { $authBootstrapSecret.Dispose() }
    if ($null -ne $authBootstrapRepeat) { $authBootstrapRepeat.Dispose() }
    $authBootstrapPayload = $null
    $authBootstrapPassword = $null
    $authBootstrapConfirmationPassword = $null
    $OutputEncoding = $authBootstrapEncoding
    [Console]::OutputEncoding = $authBootstrapConsoleEncoding
}
exit $authBootstrapExit
