import { useLobeSettings } from "../LobeContext";

const ThemeButtons = [
  { id: "light", icon: "â˜€ï¸", label: "Light" },
  { id: "dark", icon: "ðŸŒ™", label: "Dark" },
];

export function TopBar() {
  const {
    theme,
    setTheme,
    toggleTheme,
    compactMode,
    setCompactMode,
    showRightPanel,
    setShowRightPanel,
  } = useLobeSettings();

  return (
    <header className="lobe-topbar">
      <div className="lobe-topbar__title">
        <h1>CodexWebUI</h1>
        <p>Forge-style creative workspace powered by the Lobe layout.</p>
      </div>
      <div className="lobe-topbar__controls">
        <div className="lobe-control-group" role="group" aria-label="Theme mode">
          {ThemeButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              className={`lobe-chip ${theme === btn.id ? "is-active" : ""}`}
              onClick={() => setTheme(btn.id)}
              aria-pressed={theme === btn.id}
              title={`${btn.label} theme`}
            >
              <span aria-hidden="true">{btn.icon}</span>
              <span className="lobe-chip__label">{btn.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="lobe-chip lobe-chip--ghost"
            onClick={toggleTheme}
            title="Toggle theme"
          >
            <span aria-hidden="true">â‡†</span>
          </button>
        </div>
        <button
          type="button"
          className={`lobe-toggle ${compactMode ? "is-on" : ""}`}
          onClick={() => setCompactMode((prev) => !prev)}
          aria-pressed={compactMode}
          title="Toggle compact density"
        >
          <span className="lobe-toggle__thumb" aria-hidden="true" />
          <span className="lobe-toggle__label">Compact</span>
        </button>
        <button
          type="button"
          className={`lobe-toggle ${showRightPanel ? "is-on" : ""}`}
          onClick={() => setShowRightPanel((prev) => !prev)}
          aria-pressed={showRightPanel}
          title="Toggle preview panel"
        >
          <span className="lobe-toggle__thumb" aria-hidden="true" />
          <span className="lobe-toggle__label">Preview</span>
        </button>
      </div>
    </header>
  );
}
