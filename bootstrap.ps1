# Bootstrap for CodexWebUI (Windows PowerShell)
# Run from repo root:  .\bootstrap.ps1  [-Rebuild]

param([switch]$Rebuild)

$ErrorActionPreference = "Stop"

function Write-Ok($msg){ Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Step($msg){ Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# ---------- Paths ----------
$ROOT = (Get-Location).Path
$VENV = Join-Path $ROOT ".venv"
$API  = Join-Path $ROOT "apps\api"
$WEB  = Join-Path $ROOT "apps\web"

# ---------- Helpers ----------
function Ensure-Dir($p){ if(!(Test-Path $p)){ New-Item -ItemType Directory -Path $p | Out-Null } }

function Ensure-Venv {
  Write-Step "Python venv"
  if($Rebuild -and (Test-Path $VENV)){ Remove-Item -Recurse -Force $VENV }
  if(!(Test-Path $VENV)){ 
    python -m venv .venv
    Write-Ok "Created .venv"
  } else { Write-Ok ".venv already exists" }
}

function Activate-Venv {
  $activate = Join-Path $VENV "Scripts\Activate.ps1"
  if(!(Test-Path $activate)){ throw "Venv missing; run Ensure-Venv first." }
  & $activate
  Write-Ok "Venv activated"
}

function Setup-API {
  Write-Step "Scaffold FastAPI"
  Ensure-Dir $API
  $req = @'
fastapi==0.112.0
uvicorn[standard]==0.30.1
orjson==3.10.7
pydantic==2.8.2
'@
  $req | Out-File -Encoding utf8 (Join-Path $API "requirements.txt")

  $main = @'
from fastapi import FastAPI
from pydantic import BaseModel
import uuid

app = FastAPI(title="CodexWebUI API")

class JobCreate(BaseModel):
    type: str = "pipeline.run"
    payload: dict = {}

JOBS = {}

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/jobs")
def create_job(req: JobCreate):
    jid = uuid.uuid4().hex[:12]
    JOBS[jid] = {"status": "done", "result": {"echo": req.model_dump()}}
    return {"id": jid}

@app.get("/jobs/{jid}")
def get_job(jid: str):
    return JOBS.get(jid, {"error": "not found"})
'@
  $main | Out-File -Encoding utf8 (Join-Path $API "main.py")

  pip install -r (Join-Path $API "requirements.txt")
  Write-Ok "API deps installed"
}

function Setup-Web {
  Write-Step "Scaffold React (Vite)"
  Ensure-Dir $WEB
  Set-Location $WEB

  if(!(Test-Path "package.json")){
    npm -v > $null 2>&1
    if($LASTEXITCODE -ne 0){ throw "Node.js not found in PATH" }

    # init vite+react minimal
    npm create vite@latest . -- --template react > $null
    # install deps
    npm i
  }

  # Minimal API URL wiring
  $envFile = @'
VITE_API=http://localhost:8000
'@
  $envFile | Out-File -Encoding utf8 (Join-Path $WEB ".env.local")

  # Replace App.jsx for a tiny Generate panel
  $appPath = Join-Path $WEB "src\App.jsx"
  $app = @'
import { useState } from "react";

const API = import.meta.env.VITE_API || "http://localhost:8000";

export default function App() {
  const [prompt, setPrompt] = useState("a cinematic portrait");
  const [job, setJob] = useState(null);

  async function generate() {
    const res = await fetch(`${API}/jobs`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        type: "pipeline.run",
        payload: { params: { prompt } }
      })
    });
    const { id } = await res.json();
    const jr = await fetch(`${API}/jobs/${id}`).then(r=>r.json());
    setJob(jr);
  }

  return (
    <div style={{padding:16, fontFamily:"system-ui"}}>
      <h1>Codex WebUI</h1>
      <textarea rows={5} style={{width:"100%"}}
        value={prompt} onChange={e=>setPrompt(e.target.value)} />
      <button onClick={generate} style={{marginTop:8}}>Generate</button>
      <pre style={{marginTop:16, background:"#111", color:"#0f0", padding:8}}>
        {JSON.stringify(job, null, 2)}
      </pre>
    </div>
  );
}
'@
  $app | Out-File -Encoding utf8 $appPath

  Set-Location $ROOT
  Write-Ok "Web scaffold ready"
}

function Run-All {
  Write-Step "Run API + Web (two terminals recommended)"
  Write-Host "Terminal A:" -ForegroundColor Yellow
  Write-Host "  cd `"$API`"; ..\..\..\.venv\Scripts\python -m uvicorn main:app --reload --port 8000" -ForegroundColor Gray
  Write-Host "Terminal B:" -ForegroundColor Yellow
  Write-Host "  cd `"$WEB`"; npm run dev -- --port 5173" -ForegroundColor Gray
}

# ---------- Execute ----------
Ensure-Venv
Activate-Venv
Setup-API
Setup-Web
Run-All

Write-Ok "Bootstrap complete."
