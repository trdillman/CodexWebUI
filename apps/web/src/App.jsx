import { useEffect, useState } from "react";
import "./index.css";

const API_BASE = import.meta.env.VITE_API ?? "http://127.0.0.1:8000";

export default function App() {
  const [health, setHealth] = useState("Checking...");

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const response = await fetch(`${API_BASE}/health`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(response.statusText || `Status ${response.status}`);
        }
        const payload = await response.json();
        if (!cancelled) {
          setHealth(payload?.ok ? "API healthy" : "API responded");
        }
      } catch (err) {
        if (!cancelled) {
          setHealth(`API unavailable: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    ping();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-container">
      <header className="app-header">
        <h1>CodexWebUI</h1>
        <p>Welcome! The full Lobe experience will arrive in the next steps.</p>
      </header>
      <section className="app-status">
        <strong>API status:</strong> <span>{health}</span>
      </section>
      <section className="app-instructions">
        <ol>
          <li>Drop checkpoints into <code>workspace/models/Stable-diffusion/</code>.</li>
          <li>Launch services with <code>PowerShell -ExecutionPolicy Bypass -File .\scripts\start_all.ps1</code>.</li>
          <li>Stay tuned: the Forge-style interface is coming shortly.</li>
        </ol>
      </section>
    </main>
  );
}


