/**
 * Small fetch wrapper for the CropGuard API.
 *
 * - URLs are relative (/api/...), so the same build works behind the Vite dev proxy
 *   and behind nginx in production.
 * - The JWT is kept in localStorage and sent as a Bearer token.
 * - Any 401 clears the session and notifies the app, which sends the user to /login.
 */

const TOKEN_KEY = 'cropguard.token';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const session = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode: the session just will not survive a reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(method, path, { body, query, signal } = {}) {
  let url = `/api${path}`;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = {};
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the server. Check your internet connection and try again.', 0);
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message || `Request failed (${response.status})`;
    // A 401 on a request that carried a token means the session is no longer valid.
    if (response.status === 401 && session.token && !path.startsWith('/auth/login')) {
      session.clear();
      onUnauthorized();
    }
    throw new ApiError(message, response.status, data?.error?.details);
  }
  return data;
}

export const api = {
  get: (path, query, opts) => request('GET', path, { query, ...opts }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path, body) => request('DELETE', path, { body }),
};
