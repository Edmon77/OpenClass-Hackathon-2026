import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button, Card, Input, Label } from '@/components/ui';

export function LoginPage() {
  const { user, ready, login, apiConfigured } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-page text-app-muted">Loading…</div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await login(id, password);
      if (!r.ok) {
        toast.error(r.error ?? 'Login failed');
        return;
      }
      toast.success('Signed in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-app-page px-4 py-10">
      <div className="mb-8 w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-app-campus text-xl font-display font-bold text-white shadow-card">
          C
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-app-label">Campus web console</h1>
        <p className="mt-2 text-sm text-app-muted">Students, teachers, and admins — same accounts as the mobile app</p>
      </div>
      <Card className="w-full max-w-md p-8 shadow-card">
        {!apiConfigured ? (
          <div className="rounded-ios border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">API URL is not configured</p>
            <p className="mt-2 text-amber-900/90">
              Set <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">VITE_API_BASE_URL</code> in{' '}
              <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">admin-web/.env</code> (or rely on
              the dev proxy — see <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">.env.example</code>
              ).
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="sid">Student / staff ID</Label>
              <Input
                id="sid"
                autoComplete="username"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="ADMIN001"
              />
            </div>
            <div>
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
