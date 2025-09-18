const DEFAULT_API = "http://127.0.0.1:8000";

export const API_BASE =
  typeof window !== "undefined" && window.__CODEX_API_BASE__
    ? window.__CODEX_API_BASE__
    : import.meta.env.VITE_API || DEFAULT_API;

const JSON_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function handleResponse(response) {
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!response.ok) {
    const errorPayload = isJson ? await response.json().catch(() => null) : null;
    const message =
      errorPayload?.detail || errorPayload?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = errorPayload;
    throw error;
  }

  if (!isJson) {
    return null;
  }

  return response.json();
}

function buildUrl(path) {
  if (!path.startsWith("/")) {
    return `${API_BASE}/${path}`;
  }
  return `${API_BASE}${path}`;
}

export async function apiGet(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    method: "GET",
    cache: "no-store",
    ...options,
  });
  return handleResponse(response);
}

export async function apiPost(path, body, options = {}) {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify(body ?? {}),
    ...options,
  });
  return handleResponse(response);
}
export async function apiDelete(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    method: "DELETE",
    cache: "no-store",
    headers: JSON_HEADERS,
    ...options,
  });
  return handleResponse(response);
}

