param(
    [switch]$SkipBootstrap
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)
    Write-Host "[start_all] $Message"
}

function Start-VisibleProcess {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $commandLine = "Set-Location `"$WorkingDirectory`"; $Command"
    $arguments = @('-NoExit', '-Command', $commandLine)
    $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Normal -PassThru
    Write-Info "Started $Name (PID $($process.Id))"
    return $process
}

function Wait-ForEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 120
    )

    Write-Info "Waiting for $Name @ $Url"
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Info "$Name ready"
                return
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw "Timed out waiting for $Name"
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path $scriptDir
$runtimeDir = Join-Path $scriptDir 'runtime'
if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}
$stateFile = Join-Path $runtimeDir 'processes.json'

if (-not $SkipBootstrap) {
    $bootstrapScript = Join-Path $repoRoot 'bootstrap.ps1'
    if (Test-Path $bootstrapScript) {
        Write-Info 'Running bootstrap.ps1'
        Start-Process powershell.exe -ArgumentList '-ExecutionPolicy','Bypass','-File',$bootstrapScript -Wait -WindowStyle Normal | Out-Null
    }
}

if (Test-Path $stateFile) {
    Write-Info 'Cleaning up previous processes'
    try {
        $existing = Get-Content $stateFile | ConvertFrom-Json
        foreach ($property in $existing.PSObject.Properties) {
            $pid = [int]$property.Value
            if (Get-Process -Id $pid -ErrorAction SilentlyContinue) {
                try {
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                } catch {}
            }
        }
    } catch {
        Write-Warning "Failed to parse existing state file: $_"
    }
    Remove-Item $stateFile -ErrorAction SilentlyContinue
}

$processes = @{}

Write-Info 'Starting SD.Next backend'
$sdnextProcess = Start-VisibleProcess -Name 'SD.Next' -WorkingDirectory $repoRoot -Command '.\\scripts\\sdnext_run.ps1'
$processes.sdnext = $sdnextProcess.Id

Write-Info 'Starting API server'
$apiDir = Join-Path $repoRoot 'apps\\api'
$apiProcess = Start-VisibleProcess -Name 'API' -WorkingDirectory $apiDir -Command 'python -m uvicorn main:app --host 127.0.0.1 --port 8000'
$processes.api = $apiProcess.Id

Write-Info 'Starting Web UI'
$webDir = Join-Path $repoRoot 'apps\\web'
$webProcess = Start-VisibleProcess -Name 'Web UI' -WorkingDirectory $webDir -Command 'npm run dev -- --host 127.0.0.1 --port 5173'
$processes.web = $webProcess.Id

$processes | ConvertTo-Json | Set-Content -Path $stateFile

Wait-ForEndpoint -Name 'SD.Next' -Url 'http://127.0.0.1:7860/sdapi/v1/sd-models' -TimeoutSeconds 180
Wait-ForEndpoint -Name 'API' -Url 'http://127.0.0.1:8000/health' -TimeoutSeconds 120
Wait-ForEndpoint -Name 'Web UI' -Url 'http://127.0.0.1:5173' -TimeoutSeconds 120

Write-Info 'Opening browser to http://127.0.0.1:5173'
Start-Process 'http://127.0.0.1:5173'

Write-Host ""; Write-Host "========================================="
Write-Host "READY ?" -ForegroundColor Green
Write-Host " UI: http://127.0.0.1:5173"
Write-Host " API: http://127.0.0.1:8000"
Write-Host " Backend: http://127.0.0.1:7860"
Write-Host "========================================="
