import { useLobeSettings } from "../LobeContext";

const TAB_ICONS = {
  generate: "âœ¨",
  settings: "âš™ï¸",
  extensions: "ðŸ§©",
  history: "ðŸ•‘",
};

export function Sidebar() {
  const { tabs, activeTab, setActiveTab, sidebarExpanded, setSidebarExpanded } = useLobeSettings();
  const onToggleSidebar = () => setSidebarExpanded((prev) => !prev);

  return (
    <aside
      className={`lobe-sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`}
      aria-label="Primary navigation"
    >
      <div className="lobe-sidebar__brand" aria-hidden={!sidebarExpanded}>
        <span className="lobe-sidebar__logo">Codex</span>
        {sidebarExpanded && <span className="lobe-sidebar__subtitle">Web UI</span>}
      </div>
      <nav className="lobe-sidebar__nav" aria-label="Sections">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={`lobe-sidebar__tab ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={isActive}
              title={tab.label}
            >
              <span className="lobe-sidebar__icon" aria-hidden="true">
                {TAB_ICONS[tab.id] || "â€¢"}
              </span>
              {sidebarExpanded && <span className="lobe-sidebar__label">{tab.label}</span>}
            </button>
          );
        })}
      </nav>
      <div className="lobe-sidebar__footer">
        <button
          type="button"
          className="lobe-sidebar__collapse"
          onClick={onToggleSidebar}
          title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <span aria-hidden="true">{sidebarExpanded ? "Â«" : "Â»"}</span>
          {sidebarExpanded && <span className="lobe-sidebar__collapse-label">{sidebarExpanded ? "Collapse" : "Expand"}</span>}
        </button>
      </div>
    </aside>
  );
}
