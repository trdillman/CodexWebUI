Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)
    Write-Host "[stop_all] $Message"
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path $scriptDir
$runtimeDir = Join-Path $scriptDir 'runtime'
$stateFile = Join-Path $runtimeDir 'processes.json'

if (-not (Test-Path $stateFile)) {
    Write-Info 'No process state file found. Nothing to stop.'
    return
}

try {
    $processInfo = Get-Content $stateFile | ConvertFrom-Json
} catch {
    throw "Unable to read process state file: $_"
}

foreach ($entry in $processInfo.PSObject.Properties) {
    $pid = [int]$entry.Value
    $name = $entry.Name
    if ($pid -le 0) { continue }
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($null -ne $process) {
        Write-Info "Stopping $name (PID $pid)"
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
        } catch {
            Write-Warning "Failed to stop PID $pid: $_"
        }
    } else {
        Write-Info "$name already stopped"
    }
}

Remove-Item $stateFile -ErrorAction SilentlyContinue
Write-Info 'Cleanup complete.'
