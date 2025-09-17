import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API ?? "http://127.0.0.1:8000";

function InputGroup({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [steps, setSteps] = useState(20);
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [cfgScale, setCfgScale] = useState(7);
  const [samplerName, setSamplerName] = useState("Euler a");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    async function checkHealth() {
      try {
        const response = await fetch(`${API_BASE}/backend/health`);
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const payload = await response.json();
        if (!cancelled) {
          setHealth({ status: "ok", detail: payload });
        }
      } catch (err) {
        if (!cancelled) {
          setHealth({ status: "error", detail: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError("Prompt is required.");
      return;
    }

    setError(null);
    setIsGenerating(true);
    setMeta(null);
    setImageUrl(null);

    const payload = {
      prompt: prompt.trim(),
      steps,
      width,
      height,
      cfg_scale: cfgScale,
      sampler_name: samplerName,
    };

    try {
      const response = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      const resolvedUrl = typeof data.image_url === "string"
        ? (data.image_url.startsWith("http") ? data.image_url : `${API_BASE}${data.image_url}`)
        : null;

      setImageUrl(resolvedUrl);
      setMeta(data.meta ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  }

  function handleClear() {
    setPrompt("");
    setSteps(20);
    setWidth(512);
    setHeight(512);
    setCfgScale(7);
    setSamplerName("Euler a");
    setImageUrl(null);
    setMeta(null);
    setError(null);
  }

  const backendStatus = (() => {
    switch (health.status) {
      case "ok":
        return "Backend: OK";
      case "error":
        return `Backend: ${health.detail}`;
      default:
        return "Backend: Checking...";
    }
  })();

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: "0 auto",
        maxWidth: 960,
        padding: "2.5rem 1.5rem 4rem",
        display: "flex",
        flexDirection: "column",
        gap: "2.5rem",
        color: "#e9ecf2",
        background: "#0d0f16",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h1 style={{ margin: 0, fontSize: "2.8rem", fontWeight: 700 }}>Codex WebUI</h1>
        <p style={{ margin: 0, color: "#9ea4b8", fontSize: "1rem" }}>
          Enter a prompt and parameters to generate images via the managed SD.Next API.
        </p>
        <div style={{ fontWeight: 600, color: health.status === "ok" ? "#34d399" : "#f87171" }}>
          {backendStatus}
        </div>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            borderRadius: 8,
            padding: "0.75rem 1rem",
            background: "#2d1b26",
            border: "1px solid #c7507a",
            color: "#f7aac4",
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
          gap: "2rem",
          alignItems: "flex-start",
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleGenerate();
          }}
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          <InputGroup label="Prompt">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={6}
              placeholder="Describe the image you want to generate"
              style={{
                resize: "vertical",
                minHeight: 180,
                borderRadius: 8,
                border: "1px solid #232735",
                background: "#141724",
                color: "inherit",
                padding: "0.75rem",
              }}
            />
          </InputGroup>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "1rem",
            }}
          >
            <InputGroup label="Steps">
              <input
                type="number"
                min={1}
                value={steps}
                onChange={(event) => setSteps(Number(event.target.value))}
                style={{
                  borderRadius: 8,
                  border: "1px solid #232735",
                  background: "#141724",
                  color: "inherit",
                  padding: "0.6rem 0.75rem",
                }}
              />
            </InputGroup>
            <InputGroup label="Width">
              <input
                type="number"
                min={64}
                value={width}
                onChange={(event) => setWidth(Number(event.target.value))}
                style={{
                  borderRadius: 8,
                  border: "1px solid #232735",
                  background: "#141724",
                  color: "inherit",
                  padding: "0.6rem 0.75rem",
                }}
              />
            </InputGroup>
            <InputGroup label="Height">
              <input
                type="number"
                min={64}
                value={height}
                onChange={(event) => setHeight(Number(event.target.value))}
                style={{
                  borderRadius: 8,
                  border: "1px solid #232735",
                  background: "#141724",
                  color: "inherit",
                  padding: "0.6rem 0.75rem",
                }}
              />
            </InputGroup>
            <InputGroup label="CFG Scale">
              <input
                type="number"
                min={1}
                max={30}
                step="0.5"
                value={cfgScale}
                onChange={(event) => setCfgScale(Number(event.target.value))}
                style={{
                  borderRadius: 8,
                  border: "1px solid #232735",
                  background: "#141724",
                  color: "inherit",
                  padding: "0.6rem 0.75rem",
                }}
              />
            </InputGroup>
            <InputGroup label="Sampler">
              <input
                type="text"
                value={samplerName}
                onChange={(event) => setSamplerName(event.target.value)}
                style={{
                  borderRadius: 8,
                  border: "1px solid #232735",
                  background: "#141724",
                  color: "inherit",
                  padding: "0.6rem 0.75rem",
                }}
              />
            </InputGroup>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              style={{
                padding: "0.75rem 1.75rem",
                borderRadius: 999,
                border: "none",
                background: isGenerating ? "#4b4f63" : "#6366f1",
                color: "white",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: isGenerating ? "not-allowed" : "pointer",
                transition: "background 0.2s ease",
              }}
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isGenerating}
              style={{
                padding: "0.75rem 1.75rem",
                borderRadius: 999,
                border: "1px solid #2c3145",
                background: "transparent",
                color: "#e9ecf2",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: isGenerating ? "not-allowed" : "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </form>

        <aside
          style={{
            background: "#141724",
            border: "1px solid #232735",
            borderRadius: 12,
            padding: "1.25rem",
            minHeight: 360,
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            width: "100%",
          }}
        >
          <h2 style={{ margin: 0 }}>Preview</h2>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Generated preview"
              style={{
                maxWidth: "100%",
                borderRadius: 12,
                border: "1px solid #2c3145",
              }}
            />
          ) : (
            <p style={{ margin: 0, color: "#848aa3" }}>No image yet.</p>
          )}

          <div style={{ width: "100%" }}>
            <h3 style={{ margin: "1rem 0 0.5rem", fontSize: "1rem" }}>Metadata</h3>
            <pre
              style={{
                margin: 0,
                padding: "1rem",
                borderRadius: 8,
                background: "#111827",
                border: "1px solid #1f2538",
                textAlign: "left",
                width: "100%",
                overflowX: "auto",
                maxHeight: 240,
              }}
            >
              {JSON.stringify(meta ?? {}, null, 2)}
            </pre>
          </div>
        </aside>
      </section>
    </main>
  );
}
