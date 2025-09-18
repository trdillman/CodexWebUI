import { useMemo } from "react";

import { useLobeSettings } from "../LobeContext";

const PREVIEW_STUB = {
  prompt: "A cinematic render of the Codex laboratory, volumetric lighting",
  modifiers: ["4k", "sharp focus", "octane render"],
  seed: 902104,
  scheduler: "DPM++",
};

const HISTORY_STACK = [
  { id: "job-9031", status: "done", label: "Loft studio â€¢ 512x768" },
  { id: "job-9030", status: "done", label: "Heroic android â€¢ 768x768" },
  { id: "job-9029", status: "queued", label: "Neon portrait â€¢ 512x512" },
];

export function RightPanel() {
  const { activeTab } = useLobeSettings();
  const accent = useMemo(() => {
    if (activeTab === "extensions") return "var(--lobe-accent-purple)";
    if (activeTab === "history") return "var(--lobe-accent-green)";
    if (activeTab === "settings") return "var(--lobe-accent-orange)";
    return "var(--lobe-accent-blue)";
  }, [activeTab]);

  return (
    <aside className="lobe-right-panel lobe-scroll" aria-label="Preview and history">
      <section className="lobe-card lobe-card--preview">
        <header>
          <h2>Preview</h2>
          <span className="lobe-badge" style={{ background: accent }}>Live</span>
        </header>
        <div className="lobe-preview">
          <div className="lobe-preview__image" role="img" aria-label="Preview placeholder" />
          <dl className="lobe-preview__meta">
            <div>
              <dt>Prompt</dt>
              <dd>{PREVIEW_STUB.prompt}</dd>
            </div>
            <div>
              <dt>Modifiers</dt>
              <dd>{PREVIEW_STUB.modifiers.join(", ")}</dd>
            </div>
            <div className="lobe-preview__meta-grid">
              <div>
                <dt>Seed</dt>
                <dd>{PREVIEW_STUB.seed}</dd>
              </div>
              <div>
                <dt>Scheduler</dt>
                <dd>{PREVIEW_STUB.scheduler}</dd>
              </div>
            </div>
          </dl>
        </div>
      </section>
      <section className="lobe-card lobe-card--history">
        <header>
          <h2>Recent Runs</h2>
        </header>
        <ul className="lobe-right-history">
          {HISTORY_STACK.map((item) => (
            <li key={item.id} className={`lobe-right-history__item is-${item.status}`}>
              <span className="lobe-right-history__dot" aria-hidden="true" />
              <div className="lobe-right-history__body">
                <strong>{item.label}</strong>
                <span>{item.status === "done" ? "Completed" : "Queued"}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
