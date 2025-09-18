import { useMemo } from "react";

import { useAppState } from "../../state/AppStateContext";
import { useLobeSettings } from "../LobeContext";

const STATUS_COLORS = {
  done: "var(--lobe-accent-green)",
  running: "var(--lobe-accent-orange)",
  error: "var(--lobe-accent-purple)",
};

export function RightPanel() {
  const { activeTab } = useLobeSettings();
  const { lastResult, jobs, generating, apiBase, cancelJob } = useAppState();

  const accent = useMemo(() => {
    if (activeTab === "extensions") return "var(--lobe-accent-purple)";
    if (activeTab === "history") return "var(--lobe-accent-green)";
    if (activeTab === "settings") return "var(--lobe-accent-orange)";
    return "var(--lobe-accent-blue)";
  }, [activeTab]);

  const previewImage = lastResult?.imageUrl ? `${apiBase}${lastResult.imageUrl}` : null;

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "queued" || job.status === "running").slice(0, 3),
    [jobs],
  );
  const recentJobs = useMemo(
    () => jobs.filter((job) => job.status === "done" || job.status === "error").slice(0, 5),
    [jobs],
  );

  return (
    <aside className="lobe-right-panel lobe-scroll" aria-label="Preview and queue summary">
      <section className="lobe-card lobe-card--preview">
        <header>
          <h2>Preview</h2>
          <span className="lobe-badge" style={{ background: accent }}>
            {generating ? "Running" : lastResult ? "Ready" : "Idle"}
          </span>
        </header>
        <div className="lobe-preview">
          {previewImage ? (
            <img className="lobe-preview__image" src={previewImage} alt="Latest generation" />
          ) : (
            <div className="lobe-preview__image-placeholder" aria-label="Preview placeholder" />
          )}
          {lastResult && (
            <dl className="lobe-preview__meta">
              <div>
                <dt>Prompt</dt>
                <dd>{lastResult.prompt}</dd>
              </div>
              {lastResult.negativePrompt && (
                <div>
                  <dt>Negative</dt>
                  <dd>{lastResult.negativePrompt}</dd>
                </div>
              )}
              {lastResult.meta && (
                <div className="lobe-preview__meta-grid">
                  <div>
                    <dt>Sampler</dt>
                    <dd>{lastResult.meta?.sampler_name || "-"}</dd>
                  </div>
                  <div>
                    <dt>Steps</dt>
                    <dd>{lastResult.meta?.steps || "-"}</dd>
                  </div>
                </div>
              )}
            </dl>
          )}
        </div>
      </section>
      <section className="lobe-card lobe-card--history">
        <header>
          <h2>Queue</h2>
        </header>
        {activeJobs.length === 0 ? (
          <p className="lobe-empty">No active jobs.</p>
        ) : (
          <ul className="lobe-right-history">
            {activeJobs.map((job) => (
              <li key={job.id} className="lobe-right-history__item is-running">
                <span className="lobe-right-history__dot" style={{ background: STATUS_COLORS.running }} aria-hidden="true" />
                <div className="lobe-right-history__body">
                  <strong>{job.prompt}</strong>
                  <div className="lobe-progress">
                    <div className="lobe-progress__track">
                      <div
                        className="lobe-progress__bar"
                        style={{ width: `${Math.min(job.progress ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="lobe-progress__value">{Math.round(job.progress ?? 0)}%</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="lobe-button lobe-button--mini"
                  onClick={() => cancelJob(job.id).catch(() => undefined)}
                  disabled={job.status !== "queued" && job.status !== "running"}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="lobe-card lobe-card--history">
        <header>
          <h2>Recent Runs</h2>
        </header>
        {recentJobs.length === 0 ? (
          <p className="lobe-empty">No runs yet</p>
        ) : (
          <ul className="lobe-right-history">
            {recentJobs.map((item) => {
              const color = STATUS_COLORS[item.status] || "var(--lobe-accent-orange)";
              const label = item.status === "done" ? "Completed" : item.error || "Error";
              return (
                <li key={item.id} className={`lobe-right-history__item is-${item.status}`}>
                  <span className="lobe-right-history__dot" style={{ background: color }} aria-hidden="true" />
                  <div className="lobe-right-history__body">
                    <strong>{item.prompt}</strong>
                    <span>{label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}

