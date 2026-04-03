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
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(`${base}${path}`, {
    ...fetchOptions,
    headers,
    body: body ?? fetchOptions.body,
    signal: fetchOptions.signal ?? controller.signal,
  });
  clearTimeout(timer);

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
