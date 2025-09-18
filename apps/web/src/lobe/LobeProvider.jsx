import { useEffect, useMemo, useState } from "react";

import { LobeContext } from "./LobeContext";
import themeConfig from "./lobe_theme_config.json";

const STORAGE_KEY = "codexwebui:lobe";
const TABS = [
  { id: "generate", label: "Generate", description: "Prompt & parameters" },
  { id: "settings", label: "Settings", description: "Runtime configuration" },
  { id: "extensions", label: "Extensions", description: "Workspace add-ons" },
  { id: "history", label: "History", description: "Recent outputs" },
];
const COLLAPSED_WIDTH = 72;
const RIGHT_PANEL_WIDTH = 360;

const readPersistedPreferences = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
};

const getPreferredTheme = (persisted) => {
  if (persisted?.theme) return persisted.theme;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
};

export function LobeProvider({ children }) {
  const persisted = useMemo(readPersistedPreferences, []);
  const [theme, setTheme] = useState(() => getPreferredTheme(persisted));
  const [compactMode, setCompactMode] = useState(() => persisted?.compactMode ?? false);
  const [sidebarExpanded, setSidebarExpanded] = useState(
    () => persisted?.sidebarExpanded ?? themeConfig.sidebarExpand ?? true,
  );
  const [activeTab, setActiveTab] = useState(() => persisted?.activeTab ?? TABS[0].id);
  const [showRightPanel, setShowRightPanel] = useState(
    () => persisted?.showRightPanel ?? themeConfig.layoutSplitPreview ?? true,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-compact", compactMode ? "true" : "false");
  }, [compactMode]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const expandedWidth = themeConfig.sidebarWidth || 280;
    document.documentElement.style.setProperty(
      "--lobe-sidebar-width-expanded",
      `${expandedWidth}px`,
    );
    document.documentElement.style.setProperty(
      "--lobe-sidebar-width-collapsed",
      `${COLLAPSED_WIDTH}px`,
    );
    document.documentElement.style.setProperty(
      "--lobe-sidebar-width",
      `${sidebarExpanded ? expandedWidth : COLLAPSED_WIDTH}px`,
    );
  }, [sidebarExpanded]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--lobe-right-panel-width", `${RIGHT_PANEL_WIDTH}px`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      theme,
      compactMode,
      sidebarExpanded,
      activeTab,
      showRightPanel,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [theme, compactMode, sidebarExpanded, activeTab, showRightPanel]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const value = useMemo(
    () => ({
      config: themeConfig,
      theme,
      setTheme,
      toggleTheme,
      compactMode,
      setCompactMode,
      sidebarExpanded,
      setSidebarExpanded,
      activeTab,
      setActiveTab,
      tabs: TABS,
      showRightPanel,
      setShowRightPanel,
    }),
    [theme, compactMode, sidebarExpanded, activeTab, showRightPanel],
  );

  return <LobeContext.Provider value={value}>{children}</LobeContext.Provider>;
}
