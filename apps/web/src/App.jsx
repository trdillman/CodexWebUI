import { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API ?? "http://localhost:8000";

export default function App() {
  const [prompt, setPrompt] = useState("a cinematic portrait of an astronaut");
  const [jobId, setJobId] = useState(null);
  const [jobState, setJobState] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!jobId) {
      return undefined;
    }

    pollRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/jobs/${jobId}`);
        if (!response.ok) {
          throw new Error(`GET /jobs/${jobId} failed (${response.status})`);
        }
        const payload = await response.json();
        setJobState(payload);
        if (payload.status && payload.status !== "processing") {
          stopPolling();
          setSubmitting(false);
        }
        if (payload.error) {
          stopPolling();
          setSubmitting(false);
          setError(typeof payload.error === "string" ? payload.error : JSON.stringify(payload.error));
        }
      } catch (err) {
        stopPolling();
        setSubmitting(false);
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 500);

    return () => stopPolling();
  }, [jobId]);

  async function handleGenerate() {
    stopPolling();
    setSubmitting(true);
    setError(null);
    setJobState(null);

    try {
      const response = await fetch(`${API_BASE}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pipeline.run",
          payload: {
            prompt,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`POST /jobs failed (${response.status})`);
      }

      const data = await response.json();
      setJobId(data.id);
      setJobState({ status: "processing" });
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "2rem 1.5rem 4rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <header>
        <h1 style={{ margin: 0 }}>Codex WebUI</h1>
        <p style={{ marginTop: 8, color: "#b5b5c0" }}>
          Submit a prompt to the stub pipeline and watch the job status update.
        </p>
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <label htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          rows={6}
          value={prompt}
          placeholder="Describe the output you want..."
          onChange={(event) => setPrompt(event.target.value)}
          style={{
            resize: "vertical",
            width: "100%",
            padding: "0.75rem",
            borderRadius: 8,
            border: "1px solid #2b2b33",
            background: "#14141a",
            color: "inherit",
          }}
        />
        <div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isSubmitting || !prompt.trim()}
            style={{
              padding: "0.6rem 1.6rem",
              borderRadius: 6,
              border: "none",
              background: isSubmitting ? "#454558" : "#6366f1",
              color: "white",
            }}
          >
            {isSubmitting ? "Working..." : "Generate"}
          </button>
        </div>
      </section>

      {error && (
        <div style={{ color: "#ff8585" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <section>
        <h2 style={{ margin: "0 0 0.5rem" }}>Job state</h2>
        <pre
          style={{
            margin: 0,
            padding: "1rem",
            borderRadius: 8,
            background: "#111118",
            border: "1px solid #2b2b33",
            overflowX: "auto",
          }}
        >
          {JSON.stringify(
            {
              id: jobId,
              ...(jobState ?? {}),
            },
            null,
            2
          )}
        </pre>
      </section>
    </main>
  );
}
