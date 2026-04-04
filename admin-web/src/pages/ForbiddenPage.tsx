import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button, Card, PageHeader } from '@/components/ui';

export function ForbiddenPage() {
  const { user, logout } = useAuth();
  return (
    <div>
      <PageHeader title="Access denied" subtitle="That page is for administrators only." />
      <Card className="max-w-lg p-6">
        <p className="text-sm text-app-label">
          Signed in as <strong className="text-app-label">{user?.name}</strong> ({user?.role}). Campus tools (assistant,
          bookings, schedule, etc.) are still available from the home overview.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => logout()}>
            Sign out
          </Button>
          <Link to="/">
            <Button variant="ghost">Home</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
