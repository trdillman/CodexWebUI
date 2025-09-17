[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

if ($host.Name -eq "ConsoleHost") {
    $Host.UI.RawUI.WindowTitle = "Codex Web"
}

function Ensure-Directory {
    param([Parameter(Mandatory=$true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Node.js (npm) must be available on PATH."
}

Ensure-Directory (Join-Path $scriptRoot "apps")
$webPath = Join-Path $scriptRoot "apps\web"
Ensure-Directory $webPath
Ensure-Directory (Join-Path $webPath "src")
Ensure-Directory (Join-Path $webPath "public")

$packageJson = Join-Path $webPath "package.json"
if (-not (Test-Path -LiteralPath $packageJson)) {
    Write-Host "Scaffolding Vite React app" -ForegroundColor Cyan
    $env:NPM_CONFIG_YES = "true"
    try {
        Push-Location $scriptRoot
        npm create vite@latest "apps/web" -- --template react -- --no-git | Out-Host
    }
    finally {
        Pop-Location
        Remove-Item Env:NPM_CONFIG_YES -ErrorAction SilentlyContinue
    }
}

$envFilePath = Join-Path $webPath ".env.local"
$envContent = "VITE_API=http://127.0.0.1:8000"
Set-Content -Path $envFilePath -Value $envContent -Encoding ascii

Push-Location $webPath
try {
    Write-Host "Installing npm dependencies" -ForegroundColor Cyan
    npm install | Out-Host

    Write-Host "Starting Vite dev server at http://127.0.0.1:5173" -ForegroundColor Green
    Write-Host "OPEN: http://127.0.0.1:5173" -ForegroundColor Yellow
    npm run dev -- --host=127.0.0.1 --port=5173
}
finally {
    Pop-Location
}


