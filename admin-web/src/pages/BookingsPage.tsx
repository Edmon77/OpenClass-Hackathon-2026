import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/time';
import { Button, Card, PageHeader, Toolbar } from '@/components/ui';

type Bk = {
  id: string;
  room_number: string;
  building_name: string;
  course_name: string;
  start_time: string;
  end_time: string;
  next_booking_preference?: boolean;
};

export function BookingsPage() {
  const qc = useQueryClient();
  const { data: rows = [], refetch } = useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: async () => {
      const data = await apiFetch<{ bookings: Bk[] }>('/bookings/mine');
      return data.bookings;
    },
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/bookings/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Cancelled');
      void qc.invalidateQueries({ queryKey: ['bookings', 'mine'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div>
      <PageHeader title="My bookings" subtitle="Same list as the mobile Schedule → bookings." />
      <Toolbar>
        <Button variant="secondary" onClick={() => refetch()}>
          Refresh
        </Button>
      </Toolbar>
      <div className="space-y-3">
        {rows.map((b) => (
          <Card key={b.id} className="p-4">
            <div className="font-medium text-app-label">{b.course_name}</div>
            <div className="text-sm text-app-muted">
              {b.building_name} · {b.room_number}
            </div>
            <div className="mt-2 text-sm text-app-subtle">
              {formatDateTime(b.start_time)} → {formatDateTime(b.end_time)}
            </div>
            {b.next_booking_preference && (
              <div className="mt-1 text-xs italic text-app-subtle">Next slot same room preferred</div>
            )}
            <Button
              variant="ghost"
              className="mt-3 text-app-destructive"
              onClick={() => {
                if (confirm('Cancel booking?')) cancelMut.mutate(b.id);
              }}
            >
              Cancel booking
            </Button>
          </Card>
        ))}
      </div>
      {rows.length === 0 && <p className="text-sm text-app-subtle">No bookings.</p>}
    </div>
  );
}
