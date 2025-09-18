# Wheel Compatibility Report

**Environment:** Windows x86_64, Python 3.11, CUDA 12.8
**Generated:** wheels_validate_and_plan.py

## Compatibility Matrix

| Package | Required | Local Wheel | Python OK? | Platform OK? | CUDA OK? | Online Compat? | Verdict |
|---------|----------|-------------|------------|--------------|----------|----------------|---------|
| torch | 2.8.0 | torch-2.8.0+cu128-cp311-cp311-win_amd64.whl | OK | OK | OK | OK | OK |
| torchvision | 0.23.0 | torchvision-0.23.0+cu128-cp311-cp311-win_amd64.whl | OK | OK | OK | OK | OK |
| torchaudio | 2.8.0 | MISSING | NO | NO | NO | OK | MISSING |
| triton | 3.4.0 | triton_windows-3.4.0.post20-cp311-cp311-win_amd64.whl | OK | OK | OK | OK | OK |
| sageattention | 2.2.0 | sageattention-2.2.0+cu128torch2.8.0.post2-cp39-abi3-win_amd64.whl | OK | OK | OK | OK | OK (version mismatch but compatible) |

## Detailed Information

### torch
- **Required Version:** 2.8.0
- **Local Wheel:** torch-2.8.0+cu128-cp311-cp311-win_amd64.whl
- **Source:** https://pytorch.org/get-started/locally/
- **Notes:** PyTorch 2.8.0 supports CUDA 12.8 and torch.compile on Windows

### torchvision
- **Required Version:** 0.23.0
- **Local Wheel:** torchvision-0.23.0+cu128-cp311-cp311-win_amd64.whl
- **Source:** https://pytorch.org/get-started/locally/
- **Notes:** TorchVision 0.23.0 is compatible with PyTorch 2.8.0 on Windows/CUDA12.8

### torchaudio
- **Required Version:** 2.8.0
- **Local Wheel:** Not found
- **Source:** https://pytorch.org/get-started/locally/
- **Notes:** TorchAudio 2.8.0 is compatible with PyTorch 2.8.0 on Windows/CUDA12.8

### triton
- **Required Version:** 3.4.0
- **Local Wheel:** triton_windows-3.4.0.post20-cp311-cp311-win_amd64.whl
- **Source:** https://github.com/openai/triton/releases
- **Notes:** Triton 3.4.0 is compatible with PyTorch 2.8.0 on Windows/CUDA12.8

### sageattention
- **Required Version:** 2.2.0
- **Local Wheel:** sageattention-2.2.0+cu128torch2.8.0.post2-cp39-abi3-win_amd64.whl
- **Source:** https://github.com/facebookresearch/sage-attention
- **Notes:** Sage-Attention 2.2.0 supports PyTorch 2.8.0 with CUDA 12.8

## Decision: PLAN NOT POSSIBLE

The following issues prevent local installation:
- torchaudio: MISSING
- sageattention: OK (version mismatch but compatible)