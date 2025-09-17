import { useState } from "react";

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
  const [error, setError] = useState(null);

  function handleGenerate() {
    setError("Generation not yet wired to the backend.");
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 500);
  }

  function handleClear() {
    setPrompt("");
    setSteps(20);
    setWidth(512);
    setHeight(512);
    setCfgScale(7);
    setSamplerName("Euler a");
    setImageUrl(null);
    setError(null);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: "0 auto",
        maxWidth: 960,
        padding: "2rem 1.5rem 4rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        color: "#e9ecf2",
        background: "#0f1016",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "2.2rem" }}>Codex WebUI</h1>
        <p style={{ margin: 0, color: "#9ea4b8" }}>
          Enter your prompt and generation parameters. Backend integration will arrive next.
        </p>
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
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <InputGroup label="Prompt">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={6}
              placeholder="Describe the image you want to generate"
              style={{
                resize: "vertical",
                minHeight: 160,
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
              disabled={isGenerating}
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
            padding: "1rem",
            minHeight: 320,
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Preview</h2>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Generated preview"
              style={{
                maxWidth: "100%",
                borderRadius: 10,
                border: "1px solid #2c3145",
              }}
            />
          ) : (
            <p style={{ margin: 0, color: "#848aa3" }}>No image yet.</p>
          )}
        </aside>
      </section>
    </main>
  );
}
