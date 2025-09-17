[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

$apiScript = Join-Path $scriptRoot "dev_api.ps1"
$webScript = Join-Path $scriptRoot "dev_web.ps1"

foreach ($path in @($apiScript, $webScript)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required script missing: $path"
    }
}

$launchArgs = @('-NoExit', '-ExecutionPolicy', 'Bypass', '-File')

Write-Host "Launching API and Web dev terminals..." -ForegroundColor Cyan
Start-Process -FilePath 'powershell.exe' -ArgumentList ($launchArgs + $apiScript) -WorkingDirectory $scriptRoot
Start-Sleep -Seconds 1
Start-Process -FilePath 'powershell.exe' -ArgumentList ($launchArgs + $webScript) -WorkingDirectory $scriptRoot

Write-Host "API:    http://localhost:8000" -ForegroundColor Green
Write-Host "Web UI: http://localhost:5173" -ForegroundColor Green
