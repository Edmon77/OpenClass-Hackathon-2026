import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ForbiddenPage } from '@/pages/ForbiddenPage';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return <div className="flex min-h-[40vh] items-center justify-center text-app-muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <ForbiddenPage />;
  return <>{children}</>;
}
