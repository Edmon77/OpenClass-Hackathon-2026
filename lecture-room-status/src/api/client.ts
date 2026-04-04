import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from './config';

const TOKEN_KEY = 'lecture_room_jwt';

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (token == null) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export type ApiError = { error: string; code?: string };

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { json?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error('EXPO_PUBLIC_API_URL is not set');

  const { timeoutMs = 15_000, json, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  const token = await getStoredToken();
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

  const externalSignal = fetchOptions.signal;
  let removeExternalAbortListener: (() => void) | null = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      const onAbort = () => controller.abort();
      externalSignal.addEventListener('abort', onAbort, { once: true });
      removeExternalAbortListener = () => externalSignal.removeEventListener('abort', onAbort);
    }
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...fetchOptions,
      headers,
      body: body ?? fetchOptions.body,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (removeExternalAbortListener) removeExternalAbortListener();
    const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
    if (name === 'AbortError') {
      if (timedOut) throw new Error(`timeout:${timeoutMs}`);
      throw new Error('aborted');
    }
    throw e;
  }
  clearTimeout(timer);
  if (removeExternalAbortListener) removeExternalAbortListener();

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Invalid response' };
  }

  if (!res.ok) {
    const err = data as ApiError & { message?: string; statusCode?: number };
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
