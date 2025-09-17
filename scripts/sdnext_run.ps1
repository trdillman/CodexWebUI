[CmdletBinding()]
param(
    [string]$Model = '',
    [switch]$Xformers,
    [switch]$New,
    [int]$Port = 7860,
    [switch]$Listen,
    [string]$DeviceId = '',
    [switch]$DirectML,
    [switch]$SDPA,
    [switch]$Safe
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot '..') | Select-Object -ExpandProperty Path
$sdnextPath = Join-Path $repoRoot 'third_party/sdnext'
$venvPath = Join-Path $scriptRoot '.sdnextvenv'
$pythonExe = Join-Path $venvPath 'Scripts\python.exe'

if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw 'Run scripts/sdnext_setup.ps1 first to create the venv.'
}

if (-not (Test-Path -LiteralPath $sdnextPath)) {
    throw "SD.Next not found at $sdnextPath"
}

$modelsDir = $null
if (-not $Model) {
    $modelsDir = Join-Path $repoRoot 'workspace\models'
    if (-not (Test-Path -LiteralPath $modelsDir)) {
        New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
    }
    Write-Host "USING MODELS DIR: $modelsDir" -ForegroundColor Cyan
    $sdFolder = Join-Path $modelsDir 'Stable-diffusion'
    if (-not (Test-Path -LiteralPath $sdFolder)) {
        New-Item -ItemType Directory -Path $sdFolder -Force | Out-Null
    }
    $hasCheckpoints = Get-ChildItem -Path $sdFolder -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $hasCheckpoints) {
        Write-Warning "No checkpoints found. Place one under workspace/models/Stable-diffusion/"
    }
}

$arguments = @('launch.py')

if ($Model) {
    $arguments += @('--ckpt', $Model)
} elseif ($modelsDir) {
    $arguments += @('--models-dir', $modelsDir)
}

if ($Xformers) { $arguments += '--use-xformers' }
if ($New) { $arguments += '--new' }
if ($DeviceId) { $arguments += @('--device-id', $DeviceId) }
if ($DirectML) { $arguments += '--use-directml' }
if ($SDPA) { $arguments += '--sdpa' }
if ($Safe) { $arguments += '--safe' }
if ($Listen) { $arguments += '--listen' }

$arguments += @('--server-name', '127.0.0.1', '--port', $Port)
$arguments += '--docs'

Push-Location $sdnextPath
try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $pythonExe
    foreach ($arg in $arguments) {
        $psi.ArgumentList.Add([string]$arg)
    }
    $psi.UseShellExecute = $true

    $process = [System.Diagnostics.Process]::Start($psi)
    if (-not $process) {
        throw 'Failed to start SD.Next'
    }

    $pidFile = Join-Path $scriptRoot 'sdnext.pid'
    $process.Id | Out-File -Encoding ascii -FilePath $pidFile
    Write-Host "[sdnext_run] SD.Next PID $($process.Id) on http://127.0.0.1:$Port" -ForegroundColor Green
}
finally {
    Pop-Location
}
