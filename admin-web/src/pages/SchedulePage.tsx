import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/time';
import { Button, Card, PageHeader, Toolbar } from '@/components/ui';

type CourseRow = {
  course_name: string;
  teacher_name: string | null;
  department: string;
  year: number;
  class_section: string;
};

type OfferingRow = {
  id: string;
  course_name: string;
  course_code: string | null;
  department: string;
  year: number;
  class_section: string;
};

type BookingRow = {
  id: string;
  room_number: string;
  building_name: string;
  course_name: string;
  start_time: string;
  end_time: string;
  next_booking_preference?: boolean;
};

function StudentSchedule() {
  const { data: courses = [], refetch } = useQuery({
    queryKey: ['my-classes'],
    queryFn: async () => {
      const d = await apiFetch<{ courses: CourseRow[] }>('/courses/my-classes');
      return d.courses;
    },
  });

  return (
    <div>
      <PageHeader title="My classes" subtitle="From /courses/my-classes" />
      <Toolbar>
        <Button variant="secondary" onClick={() => refetch()}>
          Refresh
        </Button>
      </Toolbar>
      <div className="space-y-3">
        {courses.map((c, i) => (
          <Card key={i} className="p-4">
            <div className="font-medium text-app-label">{c.course_name}</div>
            <div className="text-sm text-app-muted">
              {c.teacher_name ?? '—'} · {c.department}
            </div>
            <div className="mt-2 text-xs text-app-subtle">
              Year {c.year} · Section {c.class_section}
            </div>
          </Card>
        ))}
      </div>
      {courses.length === 0 && <p className="text-sm text-app-subtle">No classes yet.</p>}
    </div>
  );
}

function TeacherOrAdminSchedule() {
  const qc = useQueryClient();
  const { data: courses = [] } = useQuery({
    queryKey: ['bookable'],
    queryFn: async () => {
      const c = await apiFetch<{ courses: OfferingRow[] }>('/courses/bookable');
      return c.courses;
    },
  });

  const { data: bookings = [], refetch } = useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: async () => {
      const b = await apiFetch<{ bookings: BookingRow[] }>('/bookings/mine');
      return b.bookings;
    },
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/bookings/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bookings', 'mine'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle="Assigned offerings and your bookings (teacher / admin view)."
      />
      <Toolbar>
        <Button variant="secondary" onClick={() => refetch()}>
          Refresh bookings
        </Button>
        <Link to="/assistant?q=Review%20my%20assigned%20courses%20and%20bookings.">
          <Button variant="ghost" className="text-app-accent">
            Ask assistant
          </Button>
        </Link>
      </Toolbar>

      <h2 className="mb-2 text-sm font-semibold text-app-muted">Assigned courses</h2>
      <div className="mb-8 space-y-2">
        {courses.map((c) => (
          <Card key={c.id} className="p-3">
            <div className="font-medium text-app-label">{c.course_name}</div>
            <div className="text-xs text-app-subtle">
              {c.department} · Y{c.year} {c.class_section}
              {c.course_code ? ` · ${c.course_code}` : ''}
            </div>
          </Card>
        ))}
        {courses.length === 0 && <p className="text-sm text-app-subtle">No offerings assigned.</p>}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-app-muted">Upcoming bookings</h2>
      <div className="space-y-3">
        {bookings.map((b) => (
          <Card key={b.id} className="p-4">
            <div className="font-medium text-app-label">{b.course_name}</div>
            <div className="text-sm text-app-muted">
              {b.building_name} · {b.room_number}
            </div>
            <div className="text-sm text-app-subtle">
              {formatDateTime(b.start_time)} → {formatDateTime(b.end_time)}
            </div>
            <Button
              variant="ghost"
              className="mt-2 text-app-destructive"
              onClick={() => {
                if (confirm('Cancel?')) cancelMut.mutate(b.id);
              }}
            >
              Cancel
            </Button>
          </Card>
        ))}
      </div>
      {bookings.length === 0 && <p className="text-sm text-app-subtle">No bookings.</p>}
    </div>
  );
}

export function SchedulePage() {
  const { user } = useAuth();
  if (user?.role === 'student') return <StudentSchedule />;
  return <TeacherOrAdminSchedule />;
}
