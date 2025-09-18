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
    jobs,
  } = useAppState();
  const { setActiveTab } = useLobeSettings();
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
  const [status, setStatus] = useState(null);

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
      return;
    }
    setStatus({ tone: "error", message: generateError.message || "Generation failed" });
  }, [generateError]);

  const onParamChange = (id, value) => {
    setParams((prev) => ({ ...prev, [id]: value }));
  };

  const activeJobsCount = useMemo(
    () => jobs.filter((job) => job.status === "queued" || job.status === "running").length,
    [jobs],
  );

  const onGenerate = async () => {
    setStatus(null);
    if (!prompt.trim()) {
      setStatus({ tone: "error", message: "Prompt cannot be empty" });
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
      setStatus({ tone: "success", message: "Job queued. Monitor progress in the Queue tab." });
    } catch (error) {
      setStatus({ tone: "error", message: error.message || "Generation failed" });
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

      {status && (
        <div
          className={`lobe-alert ${status.tone === "success" ? "lobe-alert--success" : "lobe-alert--error"}`}
          role="alert"
        >
          {status.message}
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
        <button
          type="button"
          className="lobe-button"
          onClick={() => setActiveTab("history")}
        >
          {`View Queue (${activeJobsCount})`}
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
            setStatus(null);
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
  const [showRelaunchHint, setShowRelaunchHint] = useState(false);

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

  const deepEqual = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  const relaunchRequired = useMemo(() => {
    if (!settings) return false;
    return !deepEqual(draft.compile, settings.compile) || !deepEqual(draft.quantize, settings.quantize);
  }, [draft, settings]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaveMessage(null);
    try {
      await saveSettings(draft);
      setSaveMessage("Settings saved");
      if (relaunchRequired) {
        setShowRelaunchHint(true);
      }
    } catch (error) {
      setSaveMessage(error.message || "Unable to save settings");
    }
  };

  const updateDraft = (updater) => {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev ?? {}));
      updater(next);
      return next;
    });
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
      {relaunchRequired && (
        <div className="lobe-alert lobe-alert--warning" role="alert">
          Compile or quantization changes require restarting SD.Next. After saving, run{' '}
          <code>.\scripts\sdnext_stop.ps1</code>{' '}followed by{' '}<code>.\scripts\sdnext_run.ps1</code>{' '}to apply the new settings.
        </div>
      )}
      {showRelaunchHint && !relaunchRequired && (
        <div className="lobe-alert lobe-alert--success">
          Backend restart instructions applied. Run the restart scripts when you are ready.
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
                <option key={option.id} value={option.id} disabled={!supported}>
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
            <label className={`lobe-switch ${!extras.chroma ? "is-disabled" : ""}`}>
              <input
                type="checkbox"
                checked={Boolean(draft.features?.chroma)}
                onChange={(event) =>
                  updateDraft((next) => {
                    next.features = next.features || {};
                    next.features.chroma = event.target.checked;
                  })
                }
                disabled={!extras.chroma}
              />
              <span>Chroma models</span>
            </label>
          </div>
          {!extras.chroma && (
            <p className="lobe-help-text">
              Chroma support was not detected in this environment.
            </p>
          )}
        </section>

        <footer className="lobe-actions">
          <button type="submit" className="lobe-button lobe-button--primary" disabled={settingsSaving}>
            {settingsSaving ? "Saving..." : "Save settings"}
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
}function ExtensionsTab() {
  const { extensions, extensionsError, apiBase, refreshExtensions } = useAppState();
  const [selectedName, setSelectedName] = useState(() => (extensions?.[0]?.name ?? null));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!extensions || extensions.length === 0) {
      setSelectedName(null);
      return;
    }
    setSelectedName((prev) => (prev && extensions.some((ext) => ext.name === prev) ? prev : extensions[0].name));
  }, [extensions]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshExtensions();
    } finally {
      setRefreshing(false);
    }
  };

  const selectedExtension = extensions?.find((ext) => ext.name === selectedName) ?? null;
  const staticSrc = selectedExtension?.staticUrl ? `${apiBase}${selectedExtension.staticUrl}/index.html` : null;
  const apiEndpoint = selectedExtension?.apiUrl ? `${apiBase}${selectedExtension.apiUrl}` : null;

  const badgeSpecs = selectedExtension
    ? [
        selectedExtension.hasStatic && { label: 'Static', tone: 'static' },
        selectedExtension.hasApi && { label: 'API', tone: 'api' },
        selectedExtension.error && { label: 'Error', tone: 'error', title: selectedExtension.error },
      ].filter(Boolean)
    : [];

  return (
    <section className="lobe-workspace lobe-scroll">
      <header className="lobe-section-header lobe-section-header--row">
        <div>
          <h2>{TAB_COPY.extensions.title}</h2>
          <p>{TAB_COPY.extensions.subtitle}</p>
        </div>
        <button type="button" className="lobe-button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Rescan'}
        </button>
      </header>
      {extensionsError && (
        <div className="lobe-alert lobe-alert--error">
          Failed to load extensions: {extensionsError.message || String(extensionsError)}
        </div>
      )}
      <div className="lobe-extensions">
        <aside className="lobe-extensions__list" role="tablist" aria-label="Available extensions">
          {extensions?.length ? (
            extensions.map((ext) => {
              const isActive = ext.name === selectedName;
              return (
                <button
                  key={ext.name}
                  type="button"
                  className={`lobe-extensions__item ${isActive ? 'is-active' : ''}`}
                  onClick={() => setSelectedName(ext.name)}
                  aria-pressed={isActive}
                >
                  <span className="lobe-extensions__item-name">{ext.name}</span>
                  <span className="lobe-extensions__badges">
                    {ext.hasStatic && <span className="lobe-badge lobe-badge--static">Static</span>}
                    {ext.hasApi && <span className="lobe-badge lobe-badge--api">API</span>}
                    {ext.error && <span className="lobe-badge lobe-badge--error">Error</span>}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="lobe-empty">Drop extension folders into <code>workspace/extensions/</code>.</p>
          )}
        </aside>
        <div className="lobe-extensions__detail">
          {selectedExtension ? (
            <article className="lobe-card lobe-card--extension">
              <header className="lobe-extension__header">
                <h3>{selectedExtension.name}</h3>
                <div className="lobe-extensions__badges">
                  {badgeSpecs.map((badge) => (
                    <span
                      key={badge.label}
                      className={`lobe-badge lobe-badge--${badge.tone}`}
                      title={badge.title}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              </header>
              {selectedExtension.error && (
                <div className="lobe-alert lobe-alert--error">{selectedExtension.error}</div>
              )}
              {staticSrc ? (
                <div className="lobe-extension__frame">
                  <iframe title={`${selectedExtension.name} static panel`} src={staticSrc} />
                </div>
              ) : (
                <p className="lobe-empty">No static panel was bundled with this extension.</p>
              )}
              <div className="lobe-extension__meta">
                {apiEndpoint ? (
                  <p>API base URL: <code>{apiEndpoint}</code></p>
                ) : (
                  <p className="lobe-empty">No API router exported.</p>
                )}
                {selectedExtension.staticUrl && (
                  <p>Static mount: <code>{selectedExtension.staticUrl}</code></p>
                )}
              </div>
            </article>
          ) : (
            <article className="lobe-card lobe-card--extension">
              <h3>Awaiting extensions</h3>
              <p>No extension selected. Choose one from the list on the left to preview its UI or API endpoints.</p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}


function HistoryTab() {
  const { jobs, cancelJob } = useAppState();

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "queued" || job.status === "running"),
    [jobs],
  );
  const recentJobs = useMemo(
    () =>
      jobs
        .filter((job) => job.status === "done" || job.status === "error")
        .slice(0, 20),
    [jobs],
  );

  return (
    <section className="lobe-workspace lobe-scroll">
      <header className="lobe-section-header">
        <h2>{TAB_COPY.history.title}</h2>
        <p>{TAB_COPY.history.subtitle}</p>
      </header>
      <div className="lobe-grid lobe-grid--queue">
        <article className="lobe-card">
          <header>
            <h3>Active Jobs</h3>
            <p>Queued and running requests with best-effort cancellation.</p>
          </header>
          {activeJobs.length === 0 ? (
            <p className="lobe-empty">No active jobs.</p>
          ) : (
            <ul className="lobe-queue">
              {activeJobs.map((job) => (
                <li key={job.id} className="lobe-queue__item">
                  <div className="lobe-queue__details">
                    <strong>{job.prompt}</strong>
                    {job.negativePrompt ? (
                      <span className="lobe-history__meta"> - {job.negativePrompt}</span>
                    ) : null}
                  </div>
                  <div className="lobe-progress">
                    <div className="lobe-progress__track">
                      <div
                        className="lobe-progress__bar"
                        style={{ width: `${Math.min(job.progress ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="lobe-progress__value">{Math.round(job.progress ?? 0)}%</span>
                  </div>
                  <div className="lobe-queue__actions">
                    <button
                      type="button"
                      className="lobe-button lobe-button--mini"
                      onClick={() => cancelJob(job.id).catch(() => undefined)}
                      disabled={job.status !== "queued" && job.status !== "running"}
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="lobe-card">
          <header>
            <h3>Recent Jobs</h3>
            <p>Completed and errored jobs, newest first.</p>
          </header>
          {recentJobs.length === 0 ? (
            <p className="lobe-empty">No completed jobs yet.</p>
          ) : (
            <ul className="lobe-history">
              {recentJobs.map((job) => (
                <li key={job.id} className={`lobe-history__item is-${job.status}`}>
                  <div>
                    <strong>{job.prompt}</strong>
                    {job.negativePrompt ? (
                      <span className="lobe-history__meta"> - {job.negativePrompt}</span>
                    ) : null}
                  </div>
                  <span className="lobe-history__meta">
                    {job.status === "done" ? "Completed" : job.error || "Error"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
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















