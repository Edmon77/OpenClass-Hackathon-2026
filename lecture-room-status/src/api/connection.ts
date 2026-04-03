import { Platform } from 'react-native';

const HEALTH_PATH = '/health';

/** Quick reachability check (5s). Call before login so failures fail fast with a clear message. */
export async function probeApiHealth(base: string): Promise<{ ok: true } | { ok: false; code: 'timeout' | 'error'; detail?: string }> {
  const url = base.replace(/\/$/, '') + HEALTH_PATH;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      return { ok: false, code: 'error', detail: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e: unknown) {
    clearTimeout(t);
    const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
    if (name === 'AbortError' || String(e).includes('AbortError')) {
      return { ok: false, code: 'timeout' };
    }
    return { ok: false, code: 'error', detail: String(e) };
  }
}

/** Human-readable hints when the API cannot be reached. */
export function unreachableApiMessage(base: string, probe: { code: 'timeout' | 'error'; detail?: string }): string {
  const b = base || '(unset)';
  const lines = [
    `Cannot reach the API at ${b}.`,
    probe.code === 'timeout' ? 'Connection timed out (nothing answered in 5 s).' : `Error: ${probe.detail ?? 'unknown'}.`,
    '',
    'Checklist:',
    '• Start the API (e.g. from repo root: docker compose up --build, or run the server locally on port 3000).',
    '• EXPO_PUBLIC_API_URL must use the SAME IP as Metro (QR/exp:// line). If Metro is exp://192.168.1.6:8082, use http://192.168.1.6:3000 — not a VPN/Docker-only IP.',
    '• On a physical phone/tablet, do not use localhost — use your computer Wi‑Fi LAN IP (same subnet as Metro).',
    '• Android emulator: use http://10.0.2.2:3000 instead of localhost.',
    '• After changing lecture-room-status/.env, stop Expo (Ctrl+C) and run npx expo start again.',
  ];
  if (/localhost|127\.0\.0\.1/i.test(base) && Platform.OS !== 'web') {
    lines.splice(
      4,
      0,
      '• Your EXPO_PUBLIC_API_URL uses localhost — that points at the phone itself, not your PC. Set it to your PC IP.'
    );
  }
  return lines.join('\n');
}

/** One-line result for the login screen "Test connection" button. */
export async function testApiConnectionSummary(base: string): Promise<{ ok: true; text: string } | { ok: false; text: string }> {
  const probe = await probeApiHealth(base);
  if (probe.ok) {
    return { ok: true, text: `OK — reached ${base.replace(/\/$/, '')}/health` };
  }
  return { ok: false, text: unreachableApiMessage(base, probe) };
}
