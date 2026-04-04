import { Button, Card, PageHeader } from '@/components/ui';
import { usePolicy } from '@/context/PolicyContext';

export function PolicyPage() {
  const { policy, cutoffMinutes, advanceReminderHours, loading, refresh } = usePolicy();

  return (
    <div>
      <PageHeader
        title="Booking policy"
        subtitle="Server settings used for reminders and temporary room use (same as mobile PolicyContext)."
      />
      <div className="mb-4">
        <Button variant="secondary" onClick={() => refresh()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      <Card className="p-6">
        {policy ? (
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-app-subtle">Cutoff before class</dt>
              <dd className="text-lg font-semibold text-app-label">{cutoffMinutes} minutes</dd>
            </div>
            <div>
              <dt className="text-app-subtle">Advance reminder</dt>
              <dd className="text-lg font-semibold text-app-label">{advanceReminderHours} hours</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-app-subtle">Timezone display</dt>
              <dd className="text-app-label">{policy.timezone_display}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-app-subtle">{loading ? 'Loading policy…' : 'Could not load policy.'}</p>
        )}
      </Card>
    </div>
  );
}
