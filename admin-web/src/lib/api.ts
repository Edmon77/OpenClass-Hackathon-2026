import { getApiBaseUrl } from './config';

const TOKEN_KEY = 'campus_admin_jwt';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token == null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { json?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error('API is not configured (set VITE_API_BASE_URL or use dev proxy)');

  const { timeoutMs = 30_000, json, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: string | undefined;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const external = fetchOptions.signal;
  let removeExternalListener: (() => void) | undefined;
  let fetchSignal: AbortSignal = controller.signal;
  if (external) {
    if (typeof AbortSignal.any === 'function') {
      fetchSignal = AbortSignal.any([controller.signal, external]);
    } else {
      if (external.aborted) controller.abort();
      else {
        const onAbort = () => controller.abort();
        external.addEventListener('abort', onAbort, { once: true });
        removeExternalListener = () => external.removeEventListener('abort', onAbort);
      }
    }
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...fetchOptions,
      headers,
      body: body ?? fetchOptions.body,
      signal: fetchSignal,
    });
  } catch (e) {
    clearTimeout(timer);
    removeExternalListener?.();
    const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
    if (name === 'AbortError') {
      if (timedOut) throw new Error(`Request timed out after ${timeoutMs}ms`);
      throw new Error('Request aborted');
    }
    throw e;
  }
  clearTimeout(timer);
  removeExternalListener?.();

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Invalid response' };
  }

  if (!res.ok) {
    const err = data as { error?: string; message?: string };
    const detail =
      typeof err.message === 'string' && err.message.length > 0
        ? err.error && err.error !== err.message
          ? `${err.error}: ${err.message}`
          : err.message
        : err.error || `HTTP ${res.status}`;
    throw new Error(detail);
  }

  return data as T;
}
