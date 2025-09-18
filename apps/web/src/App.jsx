import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API ?? "http://127.0.0.1:8000";

const COMPILE_BACKENDS = [
  { value: "triton", label: "Triton" },
  { value: "stablefast", label: "StableFast" },
  { value: "deepcache", label: "DeepCache" },
  { value: "onediff", label: "OneDiff" },
  { value: "teacache", label: "TeaCache" },
];

const QUANTIZE_METHODS = [
  { value: "torchao", label: "TorchAO" },
  { value: "bitsandbytes", label: "BitsAndBytes" },
  { value: "optimum-quanto", label: "Optimum-Quanto" },
  { value: "sdnq", label: "SDNQ" },
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneDeep(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function diffSettings(base, updated) {
  const result = {};
  if (!isPlainObject(updated)) {
    return result;
  }

  for (const key of Object.keys(updated)) {
    const nextValue = updated[key];
    const prevValue = isPlainObject(base) ? base[key] : undefined;

    if (isPlainObject(nextValue)) {
      const nested = diffSettings(prevValue, nextValue);
      if (Object.keys(nested).length > 0) {
        result[key] = nested;
      }
    } else if (nextValue !== prevValue) {
      result[key] = nextValue;
    }
  }

  return result;
}

function hasPendingChanges(base, updated) {
  return Object.keys(diffSettings(base, updated)).length > 0;
}

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

  const [capabilities, setCapabilities] = useState(null);
  const [settingsSnapshot, setSettingsSnapshot] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(null);
  const [settingsToast, setSettingsToast] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setSettingsLoading(true);
      try {
        const [capRes, setRes] = await Promise.all([
          fetch(`${API_BASE}/backend/capabilities`),
          fetch(`${API_BASE}/settings`),
        ]);

        if (!capRes.ok) {
          throw new Error(`GET /backend/capabilities failed (${capRes.status})`);
        }
        if (!setRes.ok) {
          throw new Error(`GET /settings failed (${setRes.status})`);
        }

        const [capData, settingsData] = await Promise.all([
          capRes.json(),
          setRes.json(),
        ]);

        if (cancelled) {
          return;
        }

        setCapabilities(capData);
        setSettingsSnapshot(settingsData);
        setSettingsDraft(cloneDeep(settingsData));
        setSettingsError(null);
      } catch (err) {
        if (!cancelled) {
          setSettingsError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (!settingsToast) {
      return undefined;
    }
    const timer = setTimeout(() => setSettingsToast(null), 2500);
    return () => clearTimeout(timer);
  }, [settingsToast]);

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

  const isSettingsLoaded = Boolean(capabilities && settingsSnapshot && settingsDraft);
  const pendingSettingsChanges = isSettingsLoaded
    ? hasPendingChanges(settingsSnapshot, settingsDraft)
    : false;

  async function handleSaveSettings() {
    if (!isSettingsLoaded || !settingsDraft || !settingsSnapshot) {
      return;
    }

    const payload = diffSettings(settingsSnapshot, settingsDraft);
    if (Object.keys(payload).length === 0) {
      setSettingsToast("Saved");
      return;
    }

    setIsSavingSettings(true);
    try {
      const response = await fetch(`${API_BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`POST /settings failed (${response.status})`);
      }
      const saved = await response.json();
      setSettingsSnapshot(saved);
      setSettingsDraft(cloneDeep(saved));
      setSettingsError(null);
      setSettingsToast("Saved settings");
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingSettings(false);
    }
  }

  function updateSettingsDraft(section, updater) {
    setSettingsDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const next = { ...prev };
      const currentSection = isPlainObject(next[section]) ? { ...next[section] } : {};
      next[section] = updater(currentSection);
      return next;
    });
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError("Prompt is required.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setImageUrl(null);
    setMeta(null);

    try {
      const response = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          steps,
          width,
          height,
          cfg_scale: cfgScale,
          sampler_name: samplerName,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `POST /generate failed (${response.status})`);
      }

      const data = await response.json();
      const resolvedUrl = typeof data.image_url === "string"
        ? (data.image_url.startsWith("http") ? data.image_url : `${API_BASE}${data.image_url}`)
        : null;

      setImageUrl(resolvedUrl);
      setMeta(data.meta ?? {});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  }

  const quantizeStatus = (method) => {
    if (!capabilities?.quantize) {
      return null;
    }
    const key = method === "optimum-quanto" ? "optimum_quanto" : method;
    return capabilities.quantize[key];
  };

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

      {settingsToast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            background: "#166534",
            color: "#dcfce7",
            padding: "0.6rem 1rem",
            borderRadius: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            zIndex: 10,
          }}
        >
          {settingsToast}
        </div>
      )}

      <details
        open={settingsOpen}
        onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
        style={{
          border: "1px solid #1f2333",
          borderRadius: 12,
          background: "#121626",
          padding: "1rem 1.25rem",
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "1.1rem" }}>
          Settings
        </summary>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
          {settingsError && (
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
              {settingsError}
            </div>
          )}

          {settingsLoading && (
            <div style={{ color: "#9ea4b8" }}>Loading capabilities…</div>
          )}

          {isSettingsLoaded && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                    padding: "1rem",
                    border: "1px solid #1f2333",
                    borderRadius: 10,
                    background: "#14192b",
                  }}
                >
                  <strong>Compile</strong>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(settingsDraft.compile?.enabled)}
                      onChange={(event) =>
                        updateSettingsDraft("compile", (section) => ({
                          ...section,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                    <span>Enable compile</span>
                  </label>
                  <select
                    value={settingsDraft.compile?.backend ?? "triton"}
                    onChange={(event) =>
                      updateSettingsDraft("compile", (section) => ({
                        ...section,
                        backend: event.target.value,
                      }))
                    }
                    style={{
                      borderRadius: 8,
                      border: "1px solid #232735",
                      background: "#141724",
                      color: "inherit",
                      padding: "0.6rem 0.75rem",
                    }}
                  >
                    {COMPILE_BACKENDS.map(({ value, label }) => {
                      const supported = capabilities?.backends?.[value] ?? false;
                      return (
                        <option key={value} value={value} disabled={!supported}>
                          {label}{supported ? "" : " (unsupported)"}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                    padding: "1rem",
                    border: "1px solid #1f2333",
                    borderRadius: 10,
                    background: "#14192b",
                  }}
                >
                  <strong>Quantization</strong>
                  <select
                    value={settingsDraft.quantize?.method ?? ""}
                    onChange={(event) =>
                      updateSettingsDraft("quantize", (section) => ({
                        ...section,
                        method: event.target.value || null,
                      }))
                    }
                    style={{
                      borderRadius: 8,
                      border: "1px solid #232735",
                      background: "#141724",
                      color: "inherit",
                      padding: "0.6rem 0.75rem",
                    }}
                  >
                    <option value="">None</option>
                    {QUANTIZE_METHODS.map(({ value, label }) => {
                      const status = quantizeStatus(value);
                      const disabled = !status || status === false || status === "unavailable";
                      const suffix =
                        status === "cpu"
                          ? " (CPU only)"
                          : status === "gpu"
                          ? " (GPU)"
                          : disabled
                          ? " (unsupported)"
                          : "";
                      return (
                        <option key={value} value={value} disabled={disabled}>
                          {label}
                          {suffix}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                    padding: "1rem",
                    border: "1px solid #1f2333",
                    borderRadius: 10,
                    background: "#14192b",
                  }}
                >
                  <strong>Attention</strong>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(settingsDraft.attention?.sage)}
                      disabled={!capabilities?.extras?.sage_attention}
                      onChange={(event) =>
                        updateSettingsDraft("attention", (section) => ({
                          ...section,
                          sage: event.target.checked,
                        }))
                      }
                    />
                    <span>Sage attention</span>
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                    padding: "1rem",
                    border: "1px solid #1f2333",
                    borderRadius: 10,
                    background: "#14192b",
                  }}
                >
                  <strong>Performance</strong>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(settingsDraft.performance?.xformers)}
                      onChange={(event) =>
                        updateSettingsDraft("performance", (section) => ({
                          ...section,
                          xformers: event.target.checked,
                        }))
                      }
                    />
                    <span>XFormers</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(settingsDraft.performance?.sdpa)}
                      onChange={(event) =>
                        updateSettingsDraft("performance", (section) => ({
                          ...section,
                          sdpa: event.target.checked,
                        }))
                      }
                    />
                    <span>SDPA</span>
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={!pendingSettingsChanges || isSavingSettings}
                  style={{
                    padding: "0.6rem 1.4rem",
                    borderRadius: 8,
                    border: "none",
                    background: pendingSettingsChanges && !isSavingSettings ? "#2563eb" : "#334155",
                    color: "#f8fafc",
                    cursor: pendingSettingsChanges && !isSavingSettings ? "pointer" : "not-allowed",
                    fontWeight: 600,
                  }}
                >
                  {isSavingSettings ? "Saving…" : "Save"}
                </button>
                {!pendingSettingsChanges && <span style={{ color: "#9ea4b8" }}>No pending changes</span>}
              </div>
            </>
          )}
        </div>
      </details>

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
              onClick={() => {
                setPrompt("");
                setSteps(20);
                setWidth(512);
                setHeight(512);
                setCfgScale(7);
                setSamplerName("Euler a");
                setImageUrl(null);
                setMeta(null);
                setError(null);
              }}
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

          <div style={{ width: "100%" }}>
            <h3 style={{ margin: "1rem 0 0.5rem", fontSize: "1rem" }}>Current settings</h3>
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
                maxHeight: 200,
              }}
            >
              {settingsSnapshot ? JSON.stringify(settingsSnapshot, null, 2) : "Loading..."}
            </pre>
          </div>
        </aside>
      </section>
    </main>
  );
}










