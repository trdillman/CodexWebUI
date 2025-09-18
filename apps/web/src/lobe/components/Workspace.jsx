import { useMemo, useState } from "react";

import { useLobeSettings } from "../LobeContext";

const DEFAULT_PROMPT = "A serene futuristic workspace with holographic monitors and warm lighting";
const DEFAULT_NEGATIVE = "low quality, blurry, overexposed, watermark";

const PARAM_PRESETS = [
  { id: "steps", label: "Steps", min: 1, max: 50, defaultValue: 30 },
  { id: "cfg", label: "CFG Scale", min: 1, max: 30, step: 0.5, defaultValue: 7 },
  { id: "seed", label: "Seed", min: 0, max: 999999999, defaultValue: 0 },
  { id: "scheduler", label: "Scheduler", options: ["Euler", "DPM++", "DDIM"] },
];

const SETTINGS_GROUPS = [
  {
    title: "Layout",
    items: [
      { label: "Sidebar width", key: "sidebarWidth", unit: "px" },
      { label: "Preview split", key: "layoutSplitPreview" },
      { label: "Compact animation", key: "liteAnimation" },
    ],
  },
  {
    title: "Experience",
    items: [
      { label: "Theme enable web font", key: "enableWebFont" },
      { label: "Highlight UI", key: "enableHighlight" },
      { label: "Image info panel", key: "enableImageInfo" },
    ],
  },
];

const EXTENSION_PLACEHOLDERS = [
  { name: "Pose Editor", description: "Coming soon: edit poses through ControlNet." },
  { name: "Prompt Factory", description: "A modular prompt builder tailored for CodexWebUI." },
  { name: "Color Harmonizer", description: "Curate palettes and apply them to prompts instantly." },
];

const HISTORY_SAMPLE = [
  {
    id: "job-9031",
    prompt: "Sunlit loft studio with analogue synthesizers",
    createdAt: "1 min ago",
  },
  {
    id: "job-9030",
    prompt: "Charcoal illustration of a heroic android",
    createdAt: "12 min ago",
  },
  {
    id: "job-9029",
    prompt: "Photoreal portrait lit by neon",
    createdAt: "28 min ago",
  },
];

export function Workspace() {
  const { activeTab, config } = useLobeSettings();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE);
  const [paramState, setParamState] = useState(() => {
    const initial = {};
    PARAM_PRESETS.forEach((param) => {
      if (param.options) {
        initial[param.id] = param.options[0];
      } else {
        initial[param.id] = param.defaultValue;
      }
    });
    return initial;
  });

  const onParamChange = (id, value) => {
    setParamState((prev) => ({ ...prev, [id]: value }));
  };

  const settingsSnapshot = useMemo(() => {
    return SETTINGS_GROUPS.map((group) => ({
      title: group.title,
      items: group.items.map((item) => ({
        ...item,
        value: config[item.key],
      })),
    }));
  }, [config]);

  if (activeTab === "settings") {
    return (
      <section className="lobe-workspace lobe-scroll">
        <header className="lobe-section-header">
          <h2>Interface Settings</h2>
          <p>These values originate from the bundled Lobe theme configuration.</p>
        </header>
        {settingsSnapshot.map((group) => (
          <article key={group.title} className="lobe-card">
            <h3 className="lobe-card__title">{group.title}</h3>
            <dl className="lobe-card__details">
              {group.items.map((item) => (
                <div key={item.key} className="lobe-card__detail-row">
                  <dt>{item.label}</dt>
                  <dd>{String(item.value)}{item.unit ? item.unit : ""}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </section>
    );
  }

  if (activeTab === "extensions") {
    return (
      <section className="lobe-workspace lobe-scroll">
        <header className="lobe-section-header">
          <h2>Extensions</h2>
          <p>Future extension modules will appear here with static mounts and API shims.</p>
        </header>
        <div className="lobe-grid">
          {EXTENSION_PLACEHOLDERS.map((item) => (
            <article key={item.name} className="lobe-card lobe-card--extension">
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <footer>Preview placeholder</footer>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === "history") {
    return (
      <section className="lobe-workspace lobe-scroll">
        <header className="lobe-section-header">
          <h2>Generation History</h2>
          <p>The queue manager will surface live progress in a later step.</p>
        </header>
        <ul className="lobe-history">
          {HISTORY_SAMPLE.map((job) => (
            <li key={job.id} className="lobe-history__item">
              <span className="lobe-history__prompt">{job.prompt}</span>
              <span className="lobe-history__meta">{job.createdAt}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="lobe-workspace lobe-scroll">
      <header className="lobe-section-header">
        <h2>Generate</h2>
        <p>Compose prompts, adjust parameters, and render to the preview panel.</p>
      </header>
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
          />
        </article>
        <article className="lobe-card lobe-card--params">
          <header>
            <h3>Parameters</h3>
          </header>
          <div className="lobe-params">
            {PARAM_PRESETS.map((param) => (
              <div key={param.id} className="lobe-param">
                <label htmlFor={`param-${param.id}`}>{param.label}</label>
                {param.options ? (
                  <select
                    id={`param-${param.id}`}
                    value={paramState[param.id]}
                    onChange={(event) => onParamChange(param.id, event.target.value)}
                  >
                    {param.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="lobe-slider">
                    <input
                      type={param.id === "seed" ? "number" : "range"}
                      id={`param-${param.id}`}
                      min={param.min}
                      max={param.max}
                      step={param.step || 1}
                      value={paramState[param.id]}
                      onChange={(event) => onParamChange(param.id, event.target.value)}
                    />
                    <span className="lobe-slider__value">{paramState[param.id]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </article>
      </div>
      <footer className="lobe-actions">
        <button type="button" className="lobe-button lobe-button--primary">Generate</button>
        <button type="button" className="lobe-button">Queue</button>
        <button type="button" className="lobe-button lobe-button--ghost">Reset</button>
      </footer>
    </section>
  );
}
