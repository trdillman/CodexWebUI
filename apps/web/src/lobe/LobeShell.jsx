import "./lobe.css";

import { useAppState } from "../state/AppStateContext";
import { useLobeSettings } from "./LobeContext";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Workspace } from "./components/Workspace";
import { RightPanel } from "./components/RightPanel";

export function LobeShell() {
  const { showRightPanel } = useLobeSettings();
  const { ready, loading, error } = useAppState();

  return (
    <div className="lobe-app">
      <Sidebar />
      <div className="lobe-main">
        <TopBar />
        <div className="lobe-main__content">
          {!ready ? (
            <div className="lobe-loader">
              <div className="lobe-loader__spinner" aria-hidden="true" />
              <p>{loading ? "Initializing CodexWebUI…" : error?.message || "Unable to reach the API"}</p>
            </div>
          ) : (
            <>
              <Workspace />
              {showRightPanel ? <RightPanel /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
