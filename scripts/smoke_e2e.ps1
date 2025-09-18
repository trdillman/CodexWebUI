Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)
    Write-Host "[smoke_e2e] $Message"
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path $scriptDir
$runsDir = Join-Path $repoRoot 'runs'

$apiBase = 'http://127.0.0.1:8000'

Write-Info 'Checking API health'
try {
    $health = Invoke-RestMethod -Method Get -Uri "$apiBase/health" -TimeoutSec 5
} catch {
    Write-Error 'API is not reachable. Ensure start_all.ps1 has been run.'
    exit 1
}

Write-Info 'Submitting test generation (queue bypass)'
$body = @{ prompt = 'Codex smoke test'; width = 512; height = 512; queue = $false }
try {
    $response = Invoke-RestMethod -Method Post -Uri "$apiBase/generate" -Body ($body | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 120
} catch {
    Write-Error "Generation failed: $_"
    exit 1
}

$imageUrl = $response.image_url
if (-not $imageUrl) {
    Write-Error 'Response did not include image_url'
    exit 1
}

$imagePath = $imageUrl
if ($imagePath.StartsWith('/')) {
    $imagePath = $imagePath.TrimStart('/')
}
$fullImagePath = Join-Path $repoRoot $imagePath

$maxWait = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $maxWait -and -not (Test-Path $fullImagePath)) {
    Start-Sleep -Milliseconds 200
}

if (-not (Test-Path $fullImagePath)) {
    Write-Error "Generated image not found at $fullImagePath"
    exit 1
}

$info = Get-Item $fullImagePath
Write-Host "PASS" -ForegroundColor Green
Write-Host "Image: $($info.FullName)"
Write-Host "Size: $([Math]::Round($info.Length / 1KB, 2)) KB"
