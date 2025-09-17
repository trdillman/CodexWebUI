[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

if ($host.Name -eq "ConsoleHost") {
    $Host.UI.RawUI.WindowTitle = "Codex API"
}

function Ensure-Directory {
    param([Parameter(Mandatory=$true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python 3.10+ must be available on PATH."
}

$venvPath = Join-Path $scriptRoot ".venv"
if (-not (Test-Path -LiteralPath $venvPath)) {
    Write-Host "Creating Python virtual environment .venv" -ForegroundColor Cyan
    & python -m venv $venvPath
}

$venvPython = Join-Path $venvPath "Scripts\python.exe"
if (-not (Test-Path -LiteralPath $venvPython)) {
    throw "Virtual environment is missing python.exe: $venvPython"
}

Ensure-Directory (Join-Path $scriptRoot "apps")
Ensure-Directory (Join-Path $scriptRoot "apps\api")

$initPaths = @(
    (Join-Path $scriptRoot "apps\__init__.py"),
    (Join-Path $scriptRoot "apps\api\__init__.py")
)
foreach ($initPath in $initPaths) {
    if (-not (Test-Path -LiteralPath $initPath)) {
        Set-Content -Path $initPath -Value "" -Encoding ascii
    }
}

$requirementsPath = Join-Path $scriptRoot "apps\api\requirements.txt"
$requiredPackages = @(
    "fastapi==0.112.0",
    "uvicorn[standard]==0.30.1",
    "orjson==3.10.7",
    "pydantic==2.8.2",
    "httpx==0.27.2"
)
$desiredRequirements = ($requiredPackages -join "`n") + "`n"
$currentRequirements = if (Test-Path -LiteralPath $requirementsPath) {
    (Get-Content -Raw -Path $requirementsPath -Encoding UTF8) -replace "`r", ""
} else {
    ""
}
if ($currentRequirements -ne $desiredRequirements) {
    Set-Content -Path $requirementsPath -Value $requiredPackages -Encoding ascii
}

$mainPath = Join-Path $scriptRoot "apps\api\main.py"
if (-not (Test-Path -LiteralPath $mainPath)) {
    throw "apps/api/main.py is missing; restore the scaffolded API module."
}

$env:PIP_DISABLE_PIP_VERSION_CHECK = "1"
$env:PIP_NO_INPUT = "1"

Write-Host "Installing API requirements" -ForegroundColor Cyan
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install --requirement $requirementsPath

Write-Host "Starting uvicorn at http://localhost:8000" -ForegroundColor Green
& $venvPython -m uvicorn apps.api.main:app --reload --host 127.0.0.1 --port 8000
