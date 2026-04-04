import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, getStoredToken, setStoredToken } from '../api/client';
import { isApiConfigured } from '../api/config';
import { probeApiHealth, unreachableApiMessage } from '../api/connection';
import { clearAssistantStorageForUser, clearLegacyAssistantStorage } from '../lib/assistantSession';

export type AuthUser = {
  id: string;
  student_id: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  /** Department display name */
  department: string | null;
  faculty_name?: string | null;
  faculty_id?: string | null;
  department_id?: string | null;
  program?: string | null;
  field_of_study?: string | null;
  admission_type?: string | null;
  gender?: string | null;
  year: number | null;
  section?: string | null;
  /** @deprecated use section */
  class_section?: string | null;
  force_password_change: boolean;
};

type Ctx = {
  user: AuthUser | null;
  ready: boolean;
  apiConfigured: boolean;
  login: (loginId: string, password: string) => Promise<{ ok: boolean; error?: string; forcePasswordChange?: boolean }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const apiConfigured = isApiConfigured();

  const refreshUser = useCallback(async () => {
    if (!apiConfigured) return;
    const token = await getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }
    const r = await apiFetch<{ user: AuthUser }>('/auth/me');
    setUser(r.user);
  }, [apiConfigured]);

  useEffect(() => {
    (async () => {
      if (!apiConfigured) {
        setReady(true);
        return;
      }
      try {
        const token = await getStoredToken();
        if (!token) {
          setReady(true);
          return;
        }
        await refreshUser();
      } catch {
        await setStoredToken(null);
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, [apiConfigured, refreshUser]);

  const login = useCallback(
    async (loginId: string, password: string) => {
      if (!apiConfigured) return { ok: false, error: 'API not configured (set EXPO_PUBLIC_API_URL)' };
      try {
        const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
        const probe = await probeApiHealth(base);
        if (!probe.ok) {
          return { ok: false, error: unreachableApiMessage(base, probe) };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25_000);
        const res = await fetch(`${base}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ studentId: loginId.trim().toUpperCase(), password }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const text = await res.text();
        let data: { accessToken?: string; user?: AuthUser; error?: string };
        try {
          data = text ? (JSON.parse(text) as typeof data) : {};
        } catch {
          return {
            ok: false,
            error: `Login HTTP ${res.status}: not JSON. Is EXPO_PUBLIC_API_URL pointing at the API? First chars: ${text.slice(0, 80)}`,
          };
        }
        if (!res.ok) {
          return { ok: false, error: data.error ?? 'Login failed' };
        }
        if (!data.accessToken || !data.user) return { ok: false, error: 'Invalid response (no token)' };
        await setStoredToken(data.accessToken);
        setUser(data.user);
        return { ok: true, forcePasswordChange: !!data.user.force_password_change };
      } catch (e: unknown) {
        const msg = String(e);
        // RN/Hermes has no global DOMException — never use `instanceof DOMException` here.
        const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
        const isOurTimeout = name === 'AbortError' || msg.includes('AbortError');
        if (isOurTimeout) {
          return {
            ok: false,
            error:
              'Login request timed out after 25 s. The API responded to /health but /auth/login did not finish — check server logs and database. API URL: ' +
              (process.env.EXPO_PUBLIC_API_URL ?? 'unset'),
          };
        }
        if (msg.includes('Network request failed') || msg.includes('Failed to fetch') || msg.includes('aborted')) {
          return {
            ok: false,
            error:
              'Cannot reach the API. On a real phone, EXPO_PUBLIC_API_URL must be http://YOUR_PC_LAN_IP:3000 (not localhost). Ensure Docker is running and firewall allows port 3000.',
          };
        }
        return { ok: false, error: msg };
      }
    },
    [apiConfigured]
  );

  const logout = useCallback(async () => {
    if (user?.id) {
      await clearAssistantStorageForUser(user.id);
    }
    await clearLegacyAssistantStorage();
    await setStoredToken(null);
    setUser(null);
  }, [user?.id]);

  const changePassword = useCallback(
    async (newPassword: string) => {
      await apiFetch('/auth/change-password', { method: 'POST', json: { newPassword } });
      await refreshUser();
    },
    [refreshUser]
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      apiConfigured,
      login,
      logout,
      changePassword,
      refreshUser,
    }),
    [user, ready, apiConfigured, login, logout, changePassword, refreshUser]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
