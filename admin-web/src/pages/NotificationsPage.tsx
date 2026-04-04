import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/time';
import { Badge, Button, Card, PageHeader, Toolbar } from '@/components/ui';

type Row = {
  id: string;
  type: string;
  title: string;
  message: string;
  scheduled_time: string | null;
  is_read: boolean;
  created_at: string;
};

function groupByDate(items: Row[]): { title: string; data: Row[] }[] {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const groups = new Map<string, Row[]>();
  for (const item of items) {
    const d = new Date(item.created_at).toDateString();
    let label = d;
    if (d === today) label = 'Today';
    else if (d === yesterday) label = 'Yesterday';
    const existing = groups.get(label) ?? [];
    existing.push(item);
    groups.set(label, existing);
  }
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

export function NotificationsPage() {
  const qc = useQueryClient();
  const { data: rows = [], refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const data = await apiFetch<{ notifications: Row[] }>('/notifications');
      return data.notifications;
    },
  });

  const [busy, setBusy] = useState<string | null>(null);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    },
    onSuccess: (_, id) => {
      qc.setQueryData<Row[]>(['notifications'], (prev) =>
        (prev ?? []).map((r) => (r.id === id ? { ...r, is_read: true } : r))
      );
    },
    onError: (e) => toast.error(String(e)),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await apiFetch('/notifications/read-all', { method: 'POST', json: {} });
    },
    onSuccess: () => {
      qc.setQueryData<Row[]>(['notifications'], (prev) => (prev ?? []).map((r) => ({ ...r, is_read: true })));
      toast.success('All marked read');
    },
    onError: (e) => toast.error(String(e)),
  });

  const sections = useMemo(() => groupByDate(rows), [rows]);
  const unread = rows.filter((r) => !r.is_read).length;

  const onOpen = useCallback(
    (id: string, isRead: boolean) => {
      if (isRead) return;
      setBusy(id);
      markRead.mutate(id, {
        onSettled: () => setBusy(null),
      });
    },
    [markRead]
  );

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Same feed as the mobile app. Open an unread item to mark it read."
      />
      <Toolbar className="items-center">
        {unread > 0 && <Badge tone="info">{unread} unread</Badge>}
        <Button variant="secondary" onClick={() => refetch()}>
          Refresh
        </Button>
        <Button variant="secondary" onClick={() => markAll.mutate()} disabled={markAll.isPending || rows.length === 0}>
          Mark all read
        </Button>
        <Link to="/assistant?q=Summarize%20my%20unread%20notifications%20and%20what%20I%20should%20do%20next.">
          <Button variant="ghost" className="text-app-accent">
            Ask assistant
          </Button>
        </Link>
      </Toolbar>

      <div className="space-y-8">
        {sections.map((sec) => (
          <section key={sec.title}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-app-subtle">{sec.title}</h2>
            <div className="space-y-2">
              {sec.data.map((n) => (
                <Card
                  key={n.id}
                  className={`cursor-pointer p-4 transition ${!n.is_read ? 'border-app-accent/30 bg-app-accent-muted' : ''}`}
                  onClick={() => onOpen(n.id, n.is_read)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-app-label">{n.title}</div>
                      <div className="mt-1 text-sm text-app-muted">{n.message}</div>
                      <div className="mt-2 text-xs text-app-subtle">
                        {formatDateTime(n.created_at)}
                        {n.scheduled_time ? ` · scheduled ${formatDateTime(n.scheduled_time)}` : ''}
                      </div>
                    </div>
                    {!n.is_read && (
                      <Badge tone="info">{busy === n.id ? '…' : 'New'}</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
      {rows.length === 0 && <p className="text-sm text-app-subtle">No notifications.</p>}
    </div>
  );
}
