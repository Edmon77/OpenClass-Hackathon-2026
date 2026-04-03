import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '../api/client';
import { isApiConfigured } from '../api/config';
import { useAuth } from './AuthContext';

export type ServerPolicy = {
  cutoff_minutes_before_class: number;
  advance_reminder_hours: number;
  timezone_display: string;
};

type PolicyCtx = {
  policy: ServerPolicy | null;
  /** Use for cutoff math; matches server after load. */
  cutoffMinutes: number;
  advanceReminderHours: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

const PolicyContext = createContext<PolicyCtx | null>(null);

export function PolicyProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const [policy, setPolicy] = useState<ServerPolicy | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!ready || !user || !isApiConfigured()) {
      setPolicy(null);
      return;
    }
    setLoading(true);
    try {
      const p = await apiFetch<ServerPolicy>('/settings/policy');
      setPolicy(p);
    } catch {
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }, [user, ready]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const value = useMemo<PolicyCtx>(() => {
    const cm = policy?.cutoff_minutes_before_class ?? 10;
    const ar = policy?.advance_reminder_hours ?? 24;
    return {
      policy,
      cutoffMinutes: cm,
      advanceReminderHours: ar,
      loading,
      refresh,
    };
  }, [policy, loading, refresh]);

  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}

export function usePolicy(): PolicyCtx {
  const ctx = useContext(PolicyContext);
  if (!ctx) {
    return {
      policy: null,
      cutoffMinutes: 10,
      advanceReminderHours: 24,
      loading: false,
      refresh: async () => {},
    };
  }
  return ctx;
}
