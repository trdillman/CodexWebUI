# CodexWebUI

Minimal FastAPI API + React web UI harness for local development.

## Requirements

- Windows PowerShell 5.1+ (or PowerShell 7)
- Python 3.10 or newer available as `python`
- Node.js 18 or newer with `npm`

## Quickstart

1. From an elevated PowerShell you may need to unblock scripts:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
2. Launch the paired dev terminals from the repo root:
   ```powershell
   .\start_dev.ps1
   ```
3. The first terminal provisions `.venv`, installs FastAPI dependencies, and serves the API on <http://localhost:8000>.
4. The second terminal installs npm packages for the Vite React app and serves it on <http://localhost:5173>.
5. Open the web UI in your browser and submit prompts; it will call the API stub and poll job status every 500 ms.

To stop the servers, close each PowerShell window. Re-running `start_dev.ps1` is safe; each script is idempotent.

## Show the UI

```powershell
PowerShell -NoExit -ExecutionPolicy Bypass -File .\dev_web.ps1
```

Then browse to <http://127.0.0.1:5173>.

## Models workspace

All SD assets live under `workspace/models/`:
- `workspace/models/Stable-diffusion/` for checkpoints (`.ckpt`, `.safetensors`)
- `workspace/models/VAE/` for VAEs (`.vae`, `.safetensors`)
- `workspace/models/Lora/` for LoRAs (`.safetensors`)
- `workspace/models/ControlNet/` for ControlNet weights (`.pth`, `.safetensors`)
- `workspace/models/embeddings/` for textual inversion embeddings (`.pt`, `.bin`)
- `workspace/models/upscale_models/` for upscalers (`.pth`, `.safetensors`)

Drop your downloaded files into the matching folder; scripts and the managed adapter discover them automatically.
