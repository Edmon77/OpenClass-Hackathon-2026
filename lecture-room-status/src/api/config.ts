import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Host the app already uses to reach Metro (same IP the phone should use for the API on your PC).
 * Android emulator → often 10.0.2.2; LAN / Expo Go → your Wi‑Fi IP.
 */
function getMetroBundlerHost(): string | null {
  if (Platform.OS === 'web') {
    if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
      const loc = (globalThis as { location?: { hostname?: string } }).location;
      const h = loc?.hostname?.trim();
      if (h) return h;
    }
    return null;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri && typeof hostUri === 'string') {
    const host = hostUri.split(':')[0]?.trim();
    if (host) return host;
  }
  const dbg = (Constants.expoGoConfig as { debuggerHost?: string } | null)?.debuggerHost;
  if (dbg && typeof dbg === 'string') {
    const host = dbg.split(':')[0]?.trim();
    if (host) return host;
  }
  return null;
}

/**
 * Set in `.env` as EXPO_PUBLIC_API_URL:
 * - Production / CI: full URL (https://api.example.com)
 * - Dev: `auto` or leave unset → same host as Metro, port 3000 (avoids stale hotspot/LAN IPs)
 */
export function getApiBaseUrl(): string {
  const raw = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  const stripTrailing = (s: string) => s.replace(/\/$/, '');
  const normalized = stripTrailing(raw);

  if (__DEV__) {
    const wantsAuto = !normalized || /^auto$/i.test(normalized);
    if (wantsAuto) {
      const host = getMetroBundlerHost();
      if (host) return `http://${host}:3000`;
    }
  } else if (/^auto$/i.test(normalized)) {
    return '';
  }

  return stripTrailing(normalized);
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl().length > 0;
}
