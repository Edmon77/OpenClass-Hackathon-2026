import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/config';
import { useAuth } from '@/lib/auth';

export type ServerPolicy = {
  cutoff_minutes_before_class: number;
  advance_reminder_hours: number;
  timezone_display: string;
};

type PolicyCtx = {
  policy: ServerPolicy | null;
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
    if (!ready || !user || !getApiBaseUrl()) {
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
    void refresh();
  }, [refresh]);

  const value = useMemo<PolicyCtx>(() => {
    const rawCm = policy?.cutoff_minutes_before_class;
    const rawAr = policy?.advance_reminder_hours;
    const cm =
      typeof rawCm === 'number' && Number.isFinite(rawCm) && rawCm > 0 ? Math.round(rawCm) : 10;
    const ar =
      typeof rawAr === 'number' && Number.isFinite(rawAr) && rawAr > 0 ? Math.round(rawAr) : 2;
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
  const c = useContext(PolicyContext);
  if (!c) throw new Error('usePolicy outside PolicyProvider');
  return c;
}
