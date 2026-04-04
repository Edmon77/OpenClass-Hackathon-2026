import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, getStoredToken, setStoredToken } from './api';
import { clearAssistantStorageForUser } from './assistantStorage';
import { getApiBaseUrl, isApiConfigured } from './config';

export type AuthUser = {
  id: string;
  student_id: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  department: string | null;
  faculty_name?: string | null;
  faculty_id?: string | null;
  department_id?: string | null;
  force_password_change: boolean;
};

type AuthCtx = {
  user: AuthUser | null;
  ready: boolean;
  apiConfigured: boolean;
  login: (loginId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const apiConfigured = isApiConfigured();

  const refreshUser = useCallback(async () => {
    if (!apiConfigured) return;
    const token = getStoredToken();
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
        const token = getStoredToken();
        if (!token) {
          setReady(true);
          return;
        }
        await refreshUser();
      } catch {
        setStoredToken(null);
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, [apiConfigured, refreshUser]);

  const login = useCallback(
    async (loginId: string, password: string) => {
      if (!apiConfigured) return { ok: false, error: 'API not configured' };
      try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ studentId: loginId.trim().toUpperCase(), password }),
        });
        const text = await res.text();
        let data: { accessToken?: string; user?: AuthUser; error?: string } = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          return { ok: false, error: `Login failed (HTTP ${res.status})` };
        }
        if (!res.ok) return { ok: false, error: data.error ?? 'Login failed' };
        if (!data.accessToken || !data.user) return { ok: false, error: 'Invalid response' };
        setStoredToken(data.accessToken);
        setUser(data.user);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    [apiConfigured]
  );

  const logout = useCallback(() => {
    setUser((current) => {
      if (current) clearAssistantStorageForUser(current.id);
      return null;
    });
    setStoredToken(null);
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    await apiFetch('/auth/change-password', { method: 'POST', json: { newPassword } });
    await refreshUser();
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      ready,
      apiConfigured,
      login,
      logout,
      refreshUser,
      changePassword,
    }),
    [user, ready, apiConfigured, login, logout, refreshUser, changePassword]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
