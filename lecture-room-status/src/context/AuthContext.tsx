import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, getStoredToken, setStoredToken } from '../api/client';
import { isApiConfigured } from '../api/config';

export type AuthUser = {
  id: string;
  student_id: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  department: string | null;
  year: number | null;
  class_section: string | null;
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
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(`${base}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ studentId: loginId.trim().toUpperCase(), password }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = (await res.json()) as
          | { accessToken: string; user: AuthUser }
          | { error: string };
        if (!res.ok) {
          return { ok: false, error: 'error' in data ? data.error : 'Login failed' };
        }
        if (!('accessToken' in data)) return { ok: false, error: 'Invalid response' };
        await setStoredToken(data.accessToken);
        setUser(data.user);
        return { ok: true, forcePasswordChange: data.user.force_password_change };
      } catch (e: unknown) {
        const msg = String(e);
        if (e instanceof DOMException && e.name === 'AbortError') {
          return {
            ok: false,
            error:
              'Request timed out after 10 s. Check that the API is running and EXPO_PUBLIC_API_URL points to a reachable address (currently: ' +
              (process.env.EXPO_PUBLIC_API_URL ?? 'unset') +
              ').',
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
    await setStoredToken(null);
    setUser(null);
  }, []);

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
