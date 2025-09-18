import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";

import { API_BASE, apiDelete, apiGet, apiPost } from "../api/client";

const initialState = {
  ready: false,
  loading: false,
  error: null,
  backendHealth: null,
  capabilities: null,
  settings: null,
  models: { count: 0, items: [], active: null, default: null },
  modelsError: null,
  extensions: [],
  extensionsError: null,
  jobs: [],
  jobsError: null,
  settingsSaving: false,
  settingsError: null,
  generateError: null,
  generating: false,
  lastResult: null,
  history: [],
};

function toTimestamp(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortJobs(jobs) {
  return [...jobs].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt)).slice(0, 50);
}

function normalizeJob(job) {
  if (!job) return null;
  const status = job.status || "queued";
  const progress =
    typeof job.progress === "number"
      ? job.progress
      : status === "done"
        ? 100
        : 0;
  return {
    id: job.id,
    prompt: job.prompt ?? "",
    negativePrompt: job.negativePrompt ?? job.negative_prompt ?? null,
    model: job.model ?? null,
    status,
    progress,
    imageUrl: job.imageUrl ?? job.image_url ?? null,
    meta: job.meta ?? null,
    settings: job.settings ?? null,
    error: job.error ?? null,
    cancelRequested: job.cancelRequested ?? job.cancel_requested ?? false,
    createdAt: job.createdAt ?? job.created_at ?? new Date().toISOString(),
    startedAt: job.startedAt ?? job.started_at ?? null,
    completedAt: job.completedAt ?? job.completed_at ?? null,
  };
}

function upsertJob(list, job) {
  const normalized = normalizeJob(job);
  if (!normalized || !normalized.id) {
    return list;
  }
  const filtered = list.filter((item) => item.id !== normalized.id);
  return sortJobs([normalized, ...filtered]);
}

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS": {
      const jobs = sortJobs(action.payload.jobs ?? []);
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
        jobs,
        jobsError: null,
        history: jobs,
      };
    }
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
    case "EXTENSIONS_UPDATE":
      return { ...state, extensions: action.payload, extensionsError: null };
    case "EXTENSIONS_ERROR":
      return { ...state, extensionsError: action.error };
    case "JOBS_SET": {
      const jobs = sortJobs(action.payload ?? []);
      return { ...state, jobs, jobsError: null, history: jobs };
    }
    case "JOBS_ERROR":
      return { ...state, jobsError: action.error };
    case "GENERATE_REQUEST":
      return { ...state, generating: true, generateError: null };
    case "GENERATE_ERROR":
      return { ...state, generating: false, generateError: action.error };
    case "JOB_ENQUEUE": {
      const jobs = upsertJob(state.jobs, action.payload);
      return {
        ...state,
        generating: false,
        generateError: null,
        jobs,
        history: upsertJob(state.history, action.payload),
      };
    }
    case "JOB_UPDATE": {
      const jobs = upsertJob(state.jobs, action.payload);
      const history = upsertJob(state.history, action.payload);
      const updates = { jobs, history };
      if (action.payload.status === "done" && action.payload.imageUrl) {
        updates.lastResult = normalizeJob(action.payload);
        updates.generateError = null;
      }
      if (action.payload.status === "error") {
        updates.generateError = new Error(action.payload.error || "Job failed");
      }
      return { ...state, ...updates };
    }
    default:
      return state;
  }
}

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pollingHandles = useRef(new Map());

  const pollJob = useCallback(
    async (jobId) => {
      try {
        const job = await apiGet(`/jobs/${jobId}`);
        dispatch({ type: "JOB_UPDATE", payload: job });
        if (job.status === "queued" || job.status === "running") {
          const handle = window.setTimeout(() => pollJob(jobId), 800);
          pollingHandles.current.set(jobId, handle);
        } else {
          const handle = pollingHandles.current.get(jobId);
          if (handle) {
            window.clearTimeout(handle);
            pollingHandles.current.delete(jobId);
          }
        }
      } catch (error) {
        dispatch({ type: "JOBS_ERROR", error });
      }
    },
    [dispatch],
  );

  useEffect(() => {
    return () => {
      pollingHandles.current.forEach((handle) => window.clearTimeout(handle));
      pollingHandles.current.clear();
    };
  }, []);

  const load = useCallback(async () => {
    dispatch({ type: "LOAD_START" });
    try {
      const [backendHealth, capabilities, settings, models, extensions, jobs] = await Promise.all([
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
        apiGet("/jobs").catch((error) => {
          dispatch({ type: "JOBS_ERROR", error });
          return { items: [] };
        }),
      ]);

      const extensionItems = Array.isArray(extensions?.items) ? extensions.items : [];
      const jobItems = Array.isArray(jobs?.items) ? jobs.items.map(normalizeJob) : [];

      dispatch({
        type: "LOAD_SUCCESS",
        payload: {
          backendHealth,
          capabilities,
          settings,
          models,
          extensions: extensionItems,
          jobs: jobItems,
        },
      });
    } catch (error) {
      dispatch({ type: "LOAD_ERROR", error });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    state.jobs.forEach((job) => {
      const isActive = job.status === "queued" || job.status === "running";
      const existing = pollingHandles.current.get(job.id);
      if (isActive && !existing) {
        const handle = window.setTimeout(() => pollJob(job.id), 200);
        pollingHandles.current.set(job.id, handle);
      }
      if (!isActive && existing) {
        window.clearTimeout(existing);
        pollingHandles.current.delete(job.id);
      }
    });
  }, [state.jobs, pollJob]);

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

  const setDefaultModel = useCallback(
    async (name) => {
      try {
        await apiPost("/backend/models/default", { name });
        const models = await refreshModels();
        const updatedSettings = {
          ...(state.settings ?? {}),
          model: { ...(state.settings?.model ?? {}), name },
        };
        dispatch({ type: "SETTINGS_SAVE_SUCCESS", payload: updatedSettings });
        return models;
      } catch (error) {
        dispatch({ type: "MODELS_ERROR", error });
        throw error;
      }
    },
      refreshModels,
      setDefaultModel,
  );
  const refreshExtensions = useCallback(async () => {
    try {
      const response = await apiGet("/extensions");
      const items = Array.isArray(response?.items) ? response.items : [];
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

  const scheduleJobPoll = useCallback(
    (jobId) => {
      const existing = pollingHandles.current.get(jobId);
      if (existing) {
        window.clearTimeout(existing);
        pollingHandles.current.delete(jobId);
      }
      pollJob(jobId);
    },
    [pollJob],
  );

  const generate = useCallback(
    async (payload) => {
      dispatch({ type: "GENERATE_REQUEST" });
      try {
        const body = { ...payload, queue: true };
        const response = await apiPost("/generate", body);
        if (response?.job) {
          const job = normalizeJob(response.job);
          const enrichedJob = { ...job, prompt: job.prompt || payload.prompt, negativePrompt: job.negativePrompt ?? payload.negative_prompt, model: job.model ?? payload.model };
          dispatch({ type: "JOB_ENQUEUE", payload: enrichedJob });
          scheduleJobPoll(enrichedJob.id);
          return enrichedJob;
        }
        const immediateJob = normalizeJob({
          ...response,
          status: "done",
          progress: 100,
          imageUrl: response?.image_url,
          prompt: payload.prompt,
          negativePrompt: payload.negative_prompt,
          model: payload.model,
        });
        dispatch({ type: "JOB_UPDATE", payload: immediateJob });
        return immediateJob;
      } catch (error) {
        dispatch({ type: "GENERATE_ERROR", error });
        throw error;
      }
    },
    [scheduleJobPoll],
  );

  const cancelJob = useCallback(
    async (jobId) => {
      try {
        const job = await apiDelete(`/jobs/${jobId}`);
        dispatch({ type: "JOB_UPDATE", payload: job });
        return job;
      } catch (error) {
        dispatch({ type: "JOBS_ERROR", error });
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
      setDefaultModel,
      refreshExtensions,
      saveSettings,
      generate,
      cancelJob,
    }),
    [state, load, refreshModels, setDefaultModel, refreshExtensions, saveSettings, generate, cancelJob],
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



