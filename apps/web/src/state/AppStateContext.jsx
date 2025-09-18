import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";

import { API_BASE, apiGet, apiPost } from "../api/client";

const initialState = {
  ready: false,
  loading: false,
  error: null,
  backendHealth: null,
  capabilities: null,
  settings: null,
  models: { count: 0, items: [], active: null },
  modelsError: null,
  extensions: [],
  extensionsError: null,
  settingsSaving: false,
  settingsError: null,
  generateError: null,
  generating: false,
  lastResult: null,
  history: [],
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS":
      return {
        ...state,
        ready: true,
        loading: false,
        error: null,
        backendHealth: action.payload.backendHealth,
        capabilities: action.payload.capabilities,
        settings: action.payload.settings,
        models: action.payload.models,
        modelsError: null,
        extensions: action.payload.extensions,
        extensionsError: null,
      };
    case "LOAD_ERROR":
      return { ...state, loading: false, ready: false, error: action.error };
    case "SETTINGS_SAVE_START":
      return { ...state, settingsSaving: true, settingsError: null };
    case "SETTINGS_SAVE_SUCCESS":
      return { ...state, settingsSaving: false, settings: action.payload, settingsError: null };
    case "SETTINGS_SAVE_ERROR":
      return { ...state, settingsSaving: false, settingsError: action.error };
    case "MODELS_UPDATE":
      return { ...state, models: action.payload, modelsError: null };
    case "MODELS_ERROR":
      return { ...state, modelsError: action.error };
    case "GENERATE_START":
      return {
        ...state,
        generating: true,
        generateError: null,
        history: [action.payload.job, ...state.history],
      };
    case "GENERATE_SUCCESS": {
      const { clientId, job } = action.payload;
      return {
        ...state,
        generating: false,
        generateError: null,
        lastResult: job,
        history: state.history.map((entry) =>
          entry.clientId === clientId
            ? { ...entry, ...job, status: "done", completedAt: new Date().toISOString() }
            : entry,
        ),
      };
    }
    case "GENERATE_ERROR": {
      const { clientId, error } = action.payload;
      return {
        ...state,
        generating: false,
        generateError: error,
        history: state.history.map((entry) =>
          entry.clientId === clientId
            ? { ...entry, status: "error", error: error?.message }
            : entry,
        ),
      };
    }
    case "EXTENSIONS_UPDATE":
      return { ...state, extensions: action.payload, extensionsError: null };
    case "EXTENSIONS_ERROR":
      return { ...state, extensionsError: action.error };
    default:
      return state;
  }
}

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = useCallback(async () => {
    dispatch({ type: "LOAD_START" });
    try {
      const [backendHealth, capabilities, settings, models, extensions] = await Promise.all([
        apiGet("/backend/health").catch((error) => ({ ok: false, error: error?.message })),
        apiGet("/backend/capabilities"),
        apiGet("/settings"),
        apiGet("/backend/models").catch((error) => {
          dispatch({ type: "MODELS_ERROR", error });
          return { count: 0, items: [], active: null };
        }),
        apiGet("/extensions").catch((error) => {
          dispatch({ type: "EXTENSIONS_ERROR", error });
          return { items: [] };
        }),
      ]);

      const extensionItems = Array.isArray(extensions?.items) ? extensions.items : [];

      dispatch({
        type: "LOAD_SUCCESS",
        payload: { backendHealth, capabilities, settings, models, extensions: extensionItems },
      });
    } catch (error) {
      dispatch({ type: "LOAD_ERROR", error });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshModels = useCallback(async () => {
    try {
      const models = await apiGet("/backend/models");
      dispatch({ type: "MODELS_UPDATE", payload: models });
      return models;
    } catch (error) {
      dispatch({ type: "MODELS_ERROR", error });
      throw error;
    }
  }, []);

  const refreshExtensions = useCallback(async () => {
    try {
      const extensions = await apiGet("/extensions");
      const items = Array.isArray(extensions?.items) ? extensions.items : [];
      dispatch({ type: "EXTENSIONS_UPDATE", payload: items });
      return items;
    } catch (error) {
      dispatch({ type: "EXTENSIONS_ERROR", error });
      throw error;
    }
  }, []);

  const saveSettings = useCallback(async (updates) => {
    dispatch({ type: "SETTINGS_SAVE_START" });
    try {
      const merged = await apiPost("/settings", updates);
      dispatch({ type: "SETTINGS_SAVE_SUCCESS", payload: merged });
      return merged;
    } catch (error) {
      dispatch({ type: "SETTINGS_SAVE_ERROR", error });
      throw error;
    }
  }, []);

  const generate = useCallback(
    async (payload) => {
      const randomSuffix =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const clientId = `job-${randomSuffix}`;
      const jobPlaceholder = {
        clientId,
        status: "running",
        requestedAt: new Date().toISOString(),
        prompt: payload.prompt,
        negativePrompt: payload.negative_prompt,
        model: payload.model,
      };
      dispatch({ type: "GENERATE_START", payload: { job: jobPlaceholder } });

      try {
        const result = await apiPost("/generate", payload);
        const job = {
          ...result,
          clientId,
          status: "done",
          imageUrl: result.image_url,
          prompt: payload.prompt,
          negativePrompt: payload.negative_prompt,
          model: payload.model,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "GENERATE_SUCCESS", payload: { clientId, job } });
        return job;
      } catch (error) {
        dispatch({ type: "GENERATE_ERROR", payload: { clientId, error } });
        throw error;
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      ...state,
      apiBase: API_BASE,
      refresh: load,
      refreshModels,
      refreshExtensions,
      saveSettings,
      generate,
    }),
    [state, load, refreshModels, refreshExtensions, saveSettings, generate],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return ctx;
}



