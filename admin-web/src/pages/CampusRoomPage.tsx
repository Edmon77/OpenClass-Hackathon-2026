import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { usePolicy } from '@/context/PolicyContext';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/time';
import { Button, Card, Input, Label, PageHeader, Select, Toolbar } from '@/components/ui';

type CourseOpt = {
  id: string;
  course_name: string;
  department: string;
  year: number;
  class_section: string;
};

type Bk = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  course_offering_id?: string;
  course_name?: string;
};

const ALL_EVENT_TYPES = ['lecture', 'exam', 'tutor', 'defense', 'lab', 'presentation'] as const;
type EvType = (typeof ALL_EVENT_TYPES)[number];
const TEACHER_EVENTS: EvType[] = ['lecture', 'tutor', 'exam', 'lab', 'presentation'];
const CR_EVENTS: EvType[] = ['lecture', 'presentation', 'lab'];
const EVENT_LABELS: Record<EvType, string> = {
  lecture: 'Lecture',
  exam: 'Exam',
  tutor: 'Tutor',
  defense: 'Defense',
  lab: 'LAB',
  presentation: 'Presentation',
};

function allowedEvents(role?: string): EvType[] {
  if (role === 'admin') return [...ALL_EVENT_TYPES];
  if (role === 'teacher') return TEACHER_EVENTS;
  return CR_EVENTS;
}

function toLocalInput(iso: Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampusRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const { cutoffMinutes } = usePolicy();
  const qc = useQueryClient();

  const { data: roomData, refetch } = useQuery({
    queryKey: ['room', roomId],
    enabled: !!roomId,
    queryFn: async () => {
      const data = await apiFetch<{
        room: {
          room_number: string;
          floor_index: number;
          capacity: number;
          equipment_json: string | null;
          building_name: string;
        };
        bookings: Bk[];
      }>(`/rooms/${roomId!}`);
      return data;
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['bookable'],
    queryFn: async () => {
      const cdata = await apiFetch<{ courses: CourseOpt[] }>('/courses/bookable');
      return cdata.courses;
    },
  });

  const { data: subs } = useQuery({
    queryKey: ['room-alerts'],
    queryFn: async () => {
      const s = await apiFetch<{ subscriptions: { id: string; room_id: string; expires_at: string }[] }>(
        '/room-alerts'
      );
      return s.subscriptions;
    },
  });

  const serverAlertId = useMemo(
    () => subs?.find((s) => s.room_id === roomId)?.id ?? null,
    [subs, roomId]
  );

  const [courseOfferingId, setCourseOfferingId] = useState<string>('');
  const [eventType, setEventType] = useState<EvType>('lecture');
  const [startLocal, setStartLocal] = useState(() => toLocalInput(new Date(Date.now() + 10 * 60 * 1000)));
  const [endLocal, setEndLocal] = useState(() => toLocalInput(new Date(Date.now() + 40 * 60 * 1000)));
  const [nextPref, setNextPref] = useState(false);
  const [showBook, setShowBook] = useState(false);

  const canBook =
    courses.length > 0 && (user?.role === 'teacher' || user?.role === 'student' || user?.role === 'admin');

  useEffect(() => {
    if (courses.length && !courseOfferingId) setCourseOfferingId(courses[0].id);
  }, [courses, courseOfferingId]);

  const bookMut = useMutation({
    mutationFn: async () => {
      if (!roomId || !courseOfferingId) throw new Error('Select a course offering');
      const start = new Date(startLocal);
      const end = new Date(endLocal);
      if (end.getTime() <= start.getTime()) throw new Error('End must be after start');
      if (start.getTime() < Date.now()) throw new Error('Start must be in the future');
      await apiFetch('/bookings', {
        method: 'POST',
        json: {
          roomId,
          courseOfferingId,
          eventType,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          nextBookingPreference: nextPref,
        },
      });
    },
    onSuccess: () => {
      toast.success('Booking saved');
      setShowBook(false);
      void qc.invalidateQueries({ queryKey: ['room', roomId] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const cancelBk = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/bookings/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Booking cancelled');
      void qc.invalidateQueries({ queryKey: ['room', roomId] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const subscribeMut = useMutation({
    mutationFn: async () => {
      if (!roomId) throw new Error('Missing room');
      const cm = Math.min(120, Math.max(1, Math.round(cutoffMinutes)));
      await apiFetch('/room-alerts', {
        method: 'POST',
        json: { roomId, notifyBeforeMinutes: cm },
      });
    },
    onSuccess: () => {
      toast.success('Subscribed to room alerts');
      void qc.invalidateQueries({ queryKey: ['room-alerts'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const unsubMut = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/room-alerts/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Unsubscribed');
      void qc.invalidateQueries({ queryKey: ['room-alerts'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const canCancelBooking = useCallback(
    (row: Bk): boolean => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      const oid = row.course_offering_id;
      if (!oid) return false;
      return courses.some((c) => c.id === oid);
    },
    [user, courses]
  );

  if (!roomId) return <p className="text-app-subtle">Missing room.</p>;
  if (!roomData) return <p className="text-app-subtle">Loading…</p>;

  const r = roomData.room;
  let equipment: string[] = [];
  try {
    equipment = r.equipment_json ? JSON.parse(r.equipment_json) : [];
  } catch {
    equipment = [];
  }

  const evChoices = allowedEvents(user?.role);

  return (
    <div>
      <PageHeader
        title={`${r.building_name} · Room ${r.room_number}`}
        subtitle={`Floor ${r.floor_index} · Capacity ${r.capacity}`}
      />
      <Toolbar>
        <Link to={`/assistant?q=${encodeURIComponent(`Summarize room ${r.room_number} in ${r.building_name} and suggest booking options.`)}`}>
          <Button variant="secondary">Ask assistant</Button>
        </Link>
        <Button variant="secondary" onClick={() => refetch()}>
          Refresh
        </Button>
      </Toolbar>

      {equipment.length > 0 && (
        <Card className="mb-4 p-4">
          <div className="text-xs text-app-subtle">Equipment</div>
          <div className="mt-1 text-sm text-app-label">{equipment.join(', ')}</div>
        </Card>
      )}

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-app-label">Room alerts</span>
          {serverAlertId ? (
            <Button variant="danger" onClick={() => unsubMut.mutate(serverAlertId)} disabled={unsubMut.isPending}>
              Unsubscribe
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => subscribeMut.mutate()} disabled={subscribeMut.isPending}>
              Notify me (server)
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-app-subtle">
          Uses cutoff {cutoffMinutes} min before class (from policy). No local push on web.
        </p>
      </Card>

      {canBook && (
        <Card className="mb-6 p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left font-medium text-app-label"
            onClick={() => setShowBook(!showBook)}
          >
            New booking
            <span className="text-app-subtle">{showBook ? '−' : '+'}</span>
          </button>
          {showBook && (
            <div className="mt-4 space-y-3 border-t border-app-separator pt-4">
              <div>
                <Label>Offering</Label>
                <Select
                  value={courseOfferingId}
                  onChange={(e) => setCourseOfferingId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.course_name} — {c.department} Y{c.year} {c.class_section}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Event type</Label>
                <Select value={eventType} onChange={(e) => setEventType(e.target.value as EvType)}>
                  {evChoices.map((t) => (
                    <option key={t} value={t}>
                      {EVENT_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Start</Label>
                  <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
                </div>
                <div>
                  <Label>End</Label>
                  <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-app-label">
                <input type="checkbox" checked={nextPref} onChange={(e) => setNextPref(e.target.checked)} />
                Prefer same room for next slot
              </label>
              <Button onClick={() => bookMut.mutate()} disabled={bookMut.isPending}>
                Book
              </Button>
            </div>
          )}
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold text-app-label">Bookings</h2>
      <div className="space-y-2">
        {roomData.bookings
          .filter((b) => String(b.status).toLowerCase() === 'booked')
          .map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-app-label">{b.course_name ?? 'Booking'}</div>
                  <div className="text-sm text-app-muted">
                    {formatDateTime(b.start_time)} → {formatDateTime(b.end_time)}
                  </div>
                </div>
                {canCancelBooking(b) && (
                  <Button
                    variant="ghost"
                    className="text-app-destructive"
                    onClick={() => {
                      if (confirm('Cancel this booking?')) cancelBk.mutate(b.id);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </Card>
          ))}
      </div>
      {roomData.bookings.filter((b) => String(b.status).toLowerCase() === 'booked').length === 0 && (
        <p className="text-sm text-app-subtle">No active bookings.</p>
      )}
    </div>
  );
}
