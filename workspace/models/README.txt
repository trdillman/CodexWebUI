workspace/models/
  Stable-diffusion/    # Stable Diffusion checkpoints (.ckpt, .safetensors)
  VAE/                 # Variational autoencoder weights (.vae, .safetensors)
  Lora/                # LoRA adapters (.safetensors)
  ControlNet/          # ControlNet weights (.pth, .safetensors)
  embeddings/          # Textual inversion embeddings (.pt, .bin)
  upscale_models/      # Upscalers / ESRGAN weights (.pth, .safetensors)

Place downloaded models in the matching folder. These paths are managed by the repo so scripts can resolve them consistently.
