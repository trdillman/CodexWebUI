[CmdletBinding()]
param(
    [switch]$Reinstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Remove-TreeSafely {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (Test-Path -LiteralPath $Path) {
        try {
            Get-ChildItem -LiteralPath $Path -Force -Recurse | ForEach-Object {
                try { $_.Attributes = 'Normal' } catch { }
            }
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        }
        catch {
            Write-Warning "Unable to remove $Path automatically: $($_.Exception.Message)"
        }
    }
}

function Invoke-Pip {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    Write-Host "[sdnext_setup] pip" -ForegroundColor Cyan -NoNewline
    Write-Host " $($Arguments -join ' ')" -ForegroundColor DarkGray
    & $pythonExe -m pip @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "pip command failed: $($Arguments -join ' ')"
    }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot '..') | Select-Object -ExpandProperty Path
$venvPath = Join-Path $repoRoot '.sdnextvenv'
$pythonExe = Join-Path $venvPath 'Scripts\python.exe'
$sdnextPath = Join-Path $repoRoot 'third_party/sdnext'
$modelsRoot = Join-Path $repoRoot 'workspace/models'

Write-Host "[sdnext_setup] Repo: $repoRoot"
Write-Host "[sdnext_setup] SD.Next: $sdnextPath"
Write-Host "[sdnext_setup] Venv: $venvPath"

if (-not (Test-Path -LiteralPath $sdnextPath)) {
    throw "SD.Next submodule not found at $sdnextPath. Run: git submodule update --init --recursive"
}

# Run wheel validation first
Write-Host "[sdnext_setup] Validating local wheels..." -ForegroundColor Cyan
$validationScript = Join-Path $scriptRoot 'wheels_validate_and_plan.py'
if (-not (Test-Path -LiteralPath $validationScript)) {
    throw "Wheel validation script not found at $validationScript"
}

python $validationScript
if ($LASTEXITCODE -ne 0) {
    $reportFile = Join-Path $repoRoot 'build\compat_report.md'
    throw "Wheel validation failed. See $reportFile for details. No network fallback allowed."
}

Write-Host "[sdnext_setup] Wheel validation passed" -ForegroundColor Green

$legacyVenv = Join-Path $scriptRoot '.sdnextvenv'
if ((Test-Path -LiteralPath $legacyVenv) -and ($legacyVenv -ne $venvPath)) {
    Write-Host "[sdnext_setup] Removing legacy venv at $legacyVenv" -ForegroundColor Yellow
    Remove-TreeSafely -Path $legacyVenv
}

if ($Reinstall -and (Test-Path -LiteralPath $venvPath)) {
    Write-Host "[sdnext_setup] Reinstall flag detected; removing existing venv" -ForegroundColor Yellow
    Remove-TreeSafely -Path $venvPath
}

if (-not (Test-Path -LiteralPath $pythonExe)) {
    Write-Host "[sdnext_setup] Creating virtual environment" -ForegroundColor Cyan
    python -m venv $venvPath
}

if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw "Virtual environment missing expected python.exe at $pythonExe"
}

Write-Host "[sdnext_setup] Using Python: $pythonExe"

$env:PIP_DISABLE_PIP_VERSION_CHECK = '1'
$env:PIP_NO_INPUT = '1'

Invoke-Pip -Arguments @('install', '--upgrade', 'pip', 'wheel', 'setuptools')

# Install from local wheels first
$whlsDir = Join-Path $repoRoot 'whls_temporary'
if (Test-Path -LiteralPath $whlsDir) {
    Write-Host "[sdnext_setup] Installing from local wheels in $whlsDir" -ForegroundColor Cyan
    
    # Install wheels directly by filename to avoid pip naming issues
    # Install in specific order to handle dependencies correctly
    $wheelOrder = @(
        'torch-2.8.0+cu128-cp311-cp311-win_amd64.whl',
        'torchvision-0.23.0+cu128-cp311-cp311-win_amd64.whl',
        'triton_windows-3.4.0.post20-cp311-cp311-win_amd64.whl',
        'sageattention-2.2.0+cu128torch2.8.0.post2-cp39-abi3-win_amd64.whl'
    )
    
    foreach ($wheelName in $wheelOrder) {
        $wheelPath = Join-Path $whlsDir $wheelName
        if (Test-Path -LiteralPath $wheelPath) {
            Write-Host "[sdnext_setup] Installing $wheelName" -ForegroundColor DarkGray
            Invoke-Pip -Arguments @('install', $wheelPath, '--force-reinstall', '--no-deps')
        } else {
            Write-Warning "[sdnext_setup] Wheel not found: $wheelName"
        }
    }
} else {
    throw "Local wheels directory not found at $whlsDir"
}

# Install additional requirements from PyPI (small packages only)
$additionalRequirements = @(
    'accelerate>=0.20.0',
    'basicsr>=1.4.2',
    'blendmodes>=2022.2.0',
    'clean-fid>=0.1.35',
    'einops>=0.3.0',
    'fastapi>=0.100.0',
    'facexlib>=0.3.0',
    'gfpgan>=1.3.8',
    'gradio>=4.0.0',
    'inflection>=0.5.1',
    'kornia>=0.6.7',
    'lark>=1.1.2',
    'numpy>=1.24.0',
    'omegaconf>=2.1.1',
    'opencv-python>=4.6.0',
    'pillow>=9.0.0',
    'psutil',
    'pydantic>=1.10.0',
    'pytorch-lightning>=1.9.0',
    'realesrgan>=0.3.0',
    'resize-right>=0.0.2',
    'scikit-image>=0.19.0',
    'timm>=0.6.12',
    'transformers>=4.25.1'
)

Write-Host "[sdnext_setup] Installing additional requirements from PyPI" -ForegroundColor Cyan
foreach ($req in $additionalRequirements) {
    Write-Host "[sdnext_setup] Installing $req" -ForegroundColor DarkGray
    try {
        Invoke-Pip -Arguments @('install', $req)
    }
    catch {
        Write-Warning "[sdnext_setup] Failed to install $req - continuing with other packages"
    }
}

$folders = 'Stable-diffusion','VAE','Lora','ControlNet','embeddings','upscale_models'
foreach ($folder in $folders) {
    $path = Join-Path $modelsRoot $folder
    if (-not (Test-Path -LiteralPath $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
}

# Comprehensive verification
$verifyCode = @"
import json
import sys

results = {}

try:
    import torch
    results['torch'] = {
        'version': torch.__version__,
        'cuda_available': torch.cuda.is_available(),
        'cuda_version': torch.version.cuda if torch.cuda.is_available() else None,
        'torch_compile': hasattr(torch, 'compile')
    }
except Exception as e:
    results['torch'] = {'error': str(e)}

try:
    import triton
    results['triton'] = {'version': triton.__version__}
except Exception as e:
    results['triton'] = {'error': str(e)}

try:
    import sageattention
    results['sageattention'] = {'version': getattr(sageattention, '__version__', 'unknown')}
except Exception as e:
    results['sageattention'] = {'error': str(e)}

try:
    import torchao
    results['torchao'] = {'version': getattr(torchao, '__version__', 'unknown')}
except Exception as e:
    results['torchao'] = {'error': str(e)}

try:
    import optimum
    results['optimum'] = {'version': getattr(optimum, '__version__', 'unknown')}
except Exception as e:
    results['optimum'] = {'error': str(e)}

try:
    import bitsandbytes
    results['bitsandbytes'] = {'version': getattr(bitsandbytes, '__version__', 'unknown')}
except Exception as e:
    results['bitsandbytes'] = {'error': str(e)}

print(json.dumps(results, indent=2))
"@

$verifyOutput = & $pythonExe -c $verifyCode
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to verify installation'
}

try {
    $verifyInfo = $verifyOutput | ConvertFrom-Json
}
catch {
    throw "Unexpected verification output: $verifyOutput"
}

$commitFile = Join-Path $sdnextPath 'SDNEXT_COMMIT.txt'
$commit = if (Test-Path -LiteralPath $commitFile) {
    (Get-Content -Path $commitFile -Raw).Trim()
} else {
    'unknown'
}

# Display verification results
Write-Host "[sdnext_setup] Verification Results:" -ForegroundColor Cyan
foreach ($package in $verifyInfo.PSObject.Properties.Name) {
    $info = $verifyInfo.$package
    if ($info.PSObject.Properties.Name -contains 'error') {
        Write-Host "  ${package}: ERROR - $($info.error)" -ForegroundColor Red
    } else {
        $version = $info.version
        if ($package -eq 'torch') {
            $cuda = if ($info.cuda_available) { "CUDA $($info.cuda_version)" } else { "CPU only" }
            $compile = if ($info.torch_compile) { "torch.compile available" } else { "torch.compile not available" }
            Write-Host "  ${package}: $version ($cuda, $compile)" -ForegroundColor Green
        } else {
            Write-Host "  ${package}: $version" -ForegroundColor Green
        }
    }
}

Write-Host "[sdnext_setup] SD.Next commit: $commit"
Write-Host "[sdnext_setup] Models root: $modelsRoot"
Write-Host "[sdnext_setup] Setup complete" -ForegroundColor Green
