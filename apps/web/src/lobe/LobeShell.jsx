import "./lobe.css";

import { useLobeSettings } from "./LobeContext";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Workspace } from "./components/Workspace";
import { RightPanel } from "./components/RightPanel";

export function LobeShell() {
  const { showRightPanel } = useLobeSettings();

  return (
    <div className="lobe-app">
      <Sidebar />
      <div className="lobe-main">
        <TopBar />
        <div className="lobe-main__content">
          <Workspace />
          {showRightPanel ? <RightPanel /> : null}
        </div>
      </div>
    </div>
  );
}
