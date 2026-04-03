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
  options: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error('EXPO_PUBLIC_API_URL is not set');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = await getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: string | undefined;
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
    body: body ?? options.body,
    signal: options.signal ?? controller.signal,
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
    const err = data as ApiError;
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return data as T;
}
