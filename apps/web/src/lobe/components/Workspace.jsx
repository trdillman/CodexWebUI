import { useEffect, useMemo, useState } from "react";

import { useAppState } from "../../state/AppStateContext";
import { useLobeSettings } from "../LobeContext";

const DEFAULT_PROMPT = "A serene futuristic workspace with holographic monitors and warm lighting";
const DEFAULT_NEGATIVE = "low quality, blurry, overexposed, watermark";

const PARAM_PRESETS = [
  { id: "steps", label: "Steps", min: 1, max: 50, defaultValue: 30 },
  { id: "cfg", label: "CFG Scale", min: 1, max: 30, step: 0.5, defaultValue: 7 },
  { id: "seed", label: "Seed", min: 0, max: 999999999, defaultValue: 0 },
];

const SCHEDULERS = ["Euler", "DPM++ 2M", "DDIM", "Heun", "LMS"];

const TAB_COPY = {
  settings: {
    title: "Runtime Settings",
    subtitle: "Tune compile, quantization, and attention features pulled from SD.Next.",
  },
  extensions: {
    title: "Extensions",
    subtitle: "Mount A1111-compatible extensions once the loader is wired.",
  },
  history: {
    title: "History",
    subtitle: "Track completed renders and revisit metadata from SD.Next.",
  },
};

function GenerateTab() {
  const {
    models,
    settings,
    capabilities,
    generate,
    generating,
    generateError,
  } = useAppState();
  const modelsAvailable = models?.count > 0;
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE);
  const [scheduler, setScheduler] = useState(SCHEDULERS[0]);
  const [params, setParams] = useState(() => {
    const initial = {};
    PARAM_PRESETS.forEach((param) => {
      initial[param.id] = param.defaultValue;
    });
    return initial;
  });
  const [modelName, setModelName] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    if (!modelsAvailable) {
      setModelName(null);
      return;
    }
    const active = models?.active;
    const firstItem = models?.items?.[0]?.name || null;
    const settingsModel = settings?.model?.name;
    setModelName(settingsModel || active || firstItem || null);
  }, [modelsAvailable, models?.active, models?.items, settings?.model?.name]);

  useEffect(() => {
    if (!generateError) {
      setStatusMessage(null);
      return;
    }
    setStatusMessage(generateError.message || "Generation failed");
  }, [generateError]);

  const onParamChange = (id, value) => {
    setParams((prev) => ({ ...prev, [id]: value }));
  };

  const onGenerate = async () => {
    setStatusMessage(null);
    if (!prompt.trim()) {
      setStatusMessage("Prompt cannot be empty");
      return;
    }
    try {
      await generate({
        prompt,
        negative_prompt: negativePrompt || undefined,
        steps: Number(params.steps) || undefined,
        cfg_scale: Number(params.cfg) || undefined,
        seed: Number(params.seed) || undefined,
        sampler_name: scheduler,
        model: modelName || undefined,
      });
    } catch (error) {
      setStatusMessage(error.message || "Generation failed");
    }
  };

  const capabilityNotes = useMemo(() => {
    if (!capabilities?.notes) return [];
    return Object.entries(capabilities.notes).slice(0, 4);
  }, [capabilities]);

  return (
    <section className="lobe-workspace lobe-scroll">
      <header className="lobe-section-header">
        <h2>Generate</h2>
        <p>Compose prompts, adjust parameters, and render with SD.Next.</p>
      </header>

      {!modelsAvailable && (
        <div className="lobe-alert lobe-alert--warning" role="alert">
          <strong>No checkpoints found.</strong> Place a <code>.safetensors</code> or <code>.ckpt</code> file in
          <code>workspace/models/Stable-diffusion/</code> then refresh. Generation is disabled until a model is
          detected.
        </div>
      )}

      {statusMessage && (
        <div className="lobe-alert lobe-alert--error" role="alert">
          {statusMessage}
        </div>
      )}

      <div className="lobe-grid">
        <article className="lobe-card lobe-card--prompt">
          <header>
            <h3>Main prompt</h3>
          </header>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={8}
            className="lobe-textarea"
            placeholder="Describe what you want to see..."
          />
        </article>
        <article className="lobe-card lobe-card--prompt">
          <header>
            <h3>Negative prompt</h3>
          </header>
          <textarea
            value={negativePrompt}
            onChange={(event) => setNegativePrompt(event.target.value)}
            rows={6}
            className="lobe-textarea"
            placeholder="Details to avoid in the render"
          />
        </article>
        <article className="lobe-card lobe-card--params">
          <header>
            <h3>Parameters</h3>
          </header>
          <div className="lobe-params">
            <div className="lobe-param">
              <label htmlFor="model-select">Checkpoint</label>
              <select
                id="model-select"
                value={modelName || ""}
                disabled={!modelsAvailable}
                onChange={(event) => setModelName(event.target.value || null)}
              >
                {models?.items?.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.title || item.name}
                  </option>
                ))}
                {!modelsAvailable && <option value="">No models available</option>}
              </select>
            </div>
            {PARAM_PRESETS.map((param) => (
              <div key={param.id} className="lobe-param">
                <label htmlFor={`param-${param.id}`}>{param.label}</label>
                {param.id === "seed" ? (
                  <input
                    type="number"
                    id={`param-${param.id}`}
                    min={param.min}
                    max={param.max}
                    step={param.step || 1}
                    value={params[param.id]}
                    onChange={(event) => onParamChange(param.id, event.target.value)}
                    disabled={generating}
                  />
                ) : (
                  <div className="lobe-slider">
                    <input
                      type="range"
                      id={`param-${param.id}`}
                      min={param.min}
                      max={param.max}
                      step={param.step || 1}
                      value={params[param.id]}
                      onChange={(event) => onParamChange(param.id, event.target.value)}
                      disabled={generating}
                    />
                    <span className="lobe-slider__value">{params[param.id]}</span>
                  </div>
                )}
              </div>
            ))}
            <div className="lobe-param">
              <label htmlFor="scheduler">Sampler</label>
              <select
                id="scheduler"
                value={scheduler}
                onChange={(event) => setScheduler(event.target.value)}
                disabled={generating}
              >
                {SCHEDULERS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </article>
      </div>
      {capabilityNotes.length > 0 && (
        <aside className="lobe-card lobe-card--notes">
          <header>
            <h3>Environment notes</h3>
            <p>
              Pulled from the compatibility matrix. Unsupported packages are automatically disabled elsewhere in the
              UI.
            </p>
          </header>
          <dl>
            {capabilityNotes.map(([name, note]) => (
              <div key={name} className="lobe-card__detail-row">
                <dt>{name}</dt>
                <dd>{note}</dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
      <footer className="lobe-actions">
        <button
          type="button"
          className="lobe-button lobe-button--primary"
          onClick={onGenerate}
          disabled={!modelsAvailable || generating}
        >
          {generating ? "Generating..." : "Generate"}
        </button>
        <button type="button" className="lobe-button" disabled>
          Queue (soon)
        </button>
        <button
          type="button"
          className="lobe-button lobe-button--ghost"
          onClick={() => {
            setPrompt(DEFAULT_PROMPT);
            setNegativePrompt(DEFAULT_NEGATIVE);
            setParams(() => {
              const reset = {};
              PARAM_PRESETS.forEach((param) => {
                reset[param.id] = param.defaultValue;
              });
              return reset;
            });
          }}
          disabled={generating}
        >
          Reset
        </button>
      </footer>
    </section>
  );
}

function SettingsTab() {
  const { capabilities, settings, saveSettings, settingsSaving, settingsError } = useAppState();
  const [draft, setDraft] = useState(settings);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (!settingsError) return;
    setSaveMessage(settingsError.message || "Unable to save settings");
  }, [settingsError]);

  if (!draft) {
    return (
      <section className="lobe-workspace lobe-scroll">
        <div className="lobe-card">
          <p>Loading settings…</p>
        </div>
      </section>
    );
  }

  const updateDraft = (updater) => {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev ?? {}));
      updater(next);
      return next;
    });
  };

  const backendOptions = [
    { id: "triton", label: "Triton" },
    { id: "stablefast", label: "StableFast" },
    { id: "deepcache", label: "DeepCache" },
    { id: "onediff", label: "OneDiff" },
    { id: "teacache", label: "TeaCache" },
  ];

  const quantizeOptions = [
    { id: null, label: "Disabled" },
    { id: "torchao", label: "TorchAO" },
    { id: "bitsandbytes", label: "BitsAndBytes" },
    { id: "optimum_quanto", label: "Optimum-Quanto" },
    { id: "sdnq", label: "SDNQ" },
  ];

  const quantizeCapability = capabilities?.quantize ?? {};
  const backendCapability = capabilities?.backends ?? {};
  const extras = capabilities?.extras ?? {};

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaveMessage(null);
    try {
      await saveSettings(draft);
      setSaveMessage("Settings saved");
    } catch (error) {
      setSaveMessage(error.message || "Unable to save settings");
    }
  };

  const buildQuantizeLabel = (option) => {
    const value = quantizeCapability[option.id];
    if (option.id === null) return option.label;
    if (value === "cpu") return `${option.label} (CPU mode)`;
    return option.label;
  };

  const quantizeDisabledReason = (option) => {
    const value = quantizeCapability[option.id];
    if (option.id === null) return undefined;
    if (value === true || value === "cpu") return undefined;
    if (value === "unavailable") return "Unavailable on this platform";
    if (value === false || value == null) return "Not detected";
    if (typeof value === "string") return value;
    return undefined;
  };

  return (
    <section className="lobe-workspace lobe-scroll">
      <header className="lobe-section-header">
        <h2>{TAB_COPY.settings.title}</h2>
        <p>{TAB_COPY.settings.subtitle}</p>
      </header>
      {saveMessage && (
        <div className={`lobe-alert ${settingsError ? "lobe-alert--error" : "lobe-alert--success"}`}>
          {saveMessage}
        </div>
      )}
      <form className="lobe-form" onSubmit={onSubmit}>
        <section className="lobe-card">
          <header>
            <h3>Compile backends</h3>
            <p>Enable the compiler bridge and choose an available backend.</p>
          </header>
          <label className="lobe-switch">
            <input
              type="checkbox"
              checked={Boolean(draft.compile?.enabled)}
              onChange={(event) =>
                updateDraft((next) => {
                  next.compile = next.compile || {};
                  next.compile.enabled = event.target.checked;
                })
              }
            />
            <span>Enable compilation</span>
          </label>
          <select
            value={draft.compile?.backend || ""}
            onChange={(event) =>
              updateDraft((next) => {
                next.compile = next.compile || {};
                next.compile.backend = event.target.value || null;
              })
            }
          >
            {backendOptions.map((option) => {
              const supported = backendCapability?.[option.id];
              return (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={!supported}
                  title={!supported ? "Backend not detected" : undefined}
                >
                  {option.label} {supported ? "" : "(unsupported)"}
                </option>
              );
            })}
          </select>
        </section>

        <section className="lobe-card">
          <header>
            <h3>Quantization</h3>
            <p>Pick a quantization method when supported by the local environment.</p>
          </header>
          <select
            value={draft.quantize?.method ?? ""}
            onChange={(event) =>
              updateDraft((next) => {
                next.quantize = next.quantize || {};
                next.quantize.method = event.target.value || null;
              })
            }
          >
            {quantizeOptions.map((option) => {
              const disabledReason = quantizeDisabledReason(option);
              return (
                <option
                  key={option.id ?? "none"}
                  value={option.id ?? ""}
                  disabled={Boolean(disabledReason)}
                  title={disabledReason || undefined}
                >
                  {buildQuantizeLabel(option)}
                </option>
              );
            })}
          </select>
          {draft.quantize?.method === "bitsandbytes" && quantizeCapability.bitsandbytes === "cpu" && (
            <p className="lobe-help-text">
              BitsAndBytes is available in CPU mode only on this platform.
            </p>
          )}
        </section>

        <section className="lobe-card">
          <header>
            <h3>Attention & performance</h3>
            <p>Toggle Sage Attention and other performance assists surfaced by SD.Next.</p>
          </header>
          <div className="lobe-grid lobe-grid--two">
            <label className={`lobe-switch ${!extras.sage_attention ? "is-disabled" : ""}`}>
              <input
                type="checkbox"
                checked={Boolean(draft.attention?.sage)}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.attention = next.attention || {};
                    next.attention.sage = event.target.checked;
                  })
                }
                disabled={!extras.sage_attention}
              />
              <span>Sage Attention</span>
            </label>
            <label className="lobe-switch">
              <input
                type="checkbox"
                checked={Boolean(draft.performance?.xformers)}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.performance = next.performance || {};
                    next.performance.xformers = event.target.checked;
                  })
                }
              />
              <span>xFormers</span>
            </label>
            <label className="lobe-switch">
              <input
                type="checkbox"
                checked={Boolean(draft.performance?.sdpa)}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.performance = next.performance || {};
                    next.performance.sdpa = event.target.checked;
                  })
                }
              />
              <span>SDPA</span>
            </label>
            <label className="lobe-switch">
              <input
                type="checkbox"
                checked={Boolean(draft.ui?.mobile_compact)}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.ui = next.ui || {};
                    next.ui.mobile_compact = event.target.checked;
                  })
                }
              />
              <span>Mobile compact mode</span>
            </label>
          </div>
        </section>

        <footer className="lobe-actions">
          <button type="submit" className="lobe-button lobe-button--primary" disabled={settingsSaving}>
            {settingsSaving ? "Saving…" : "Save settings"}
          </button>
          <button
            type="button"
            className="lobe-button lobe-button--ghost"
            onClick={() => setDraft(settings)}
            disabled={settingsSaving}
          >
            Revert
          </button>
        </footer>
      </form>
    </section>
  );
}

function ExtensionsTab() {
  return (
    <section className="lobe-workspace lobe-scroll">
      <header className="lobe-section-header">
        <h2>{TAB_COPY.extensions.title}</h2>
        <p>{TAB_COPY.extensions.subtitle}</p>
      </header>
      <article className="lobe-card lobe-card--extension">
        <h3>Bridge in progress</h3>
        <p>The loader will surface static mounts and FastAPI shims from the extensions workspace in the upcoming step.</p>
        <footer>Sample entries will appear automatically once the bridge lands.</footer>
      </article>
    </section>
  );
}

function HistoryTab() {
  const { history } = useAppState();
  return (
    <section className="lobe-workspace lobe-scroll">
      <header className="lobe-section-header">
        <h2>{TAB_COPY.history.title}</h2>
        <p>{TAB_COPY.history.subtitle}</p>
      </header>
      {history.length === 0 ? (
        <div className="lobe-card">
          <p>No generations yet. Run a prompt to populate history.</p>
        </div>
      ) : (
        <ul className="lobe-history">
          {history.map((job) => (
            <li key={job.clientId} className={`lobe-history__item is-${job.status}`}>
              <div>
                <strong>{job.prompt}</strong>
                {job.negativePrompt ? <span className="lobe-history__meta"> – {job.negativePrompt}</span> : null}
              </div>
              <span className="lobe-history__meta">{job.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Workspace() {
  const { activeTab } = useLobeSettings();

  if (activeTab === "settings") {
    return <SettingsTab />;
  }
  if (activeTab === "extensions") {
    return <ExtensionsTab />;
  }
  if (activeTab === "history") {
    return <HistoryTab />;
  }

  return <GenerateTab />;
}
