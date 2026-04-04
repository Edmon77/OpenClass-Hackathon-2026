import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { Button, Card, Input, Label, PageHeader, Toolbar } from '@/components/ui';

type CourseItem = {
  id: string;
  course_name: string;
  course_code: string | null;
  teacher_name: string | null;
  teacher_student_id: string | null;
};

type TeacherHit = { id: string; student_id: string; name: string };
type StudentHit = { id: string; student_id: string; name: string; section: string | null };

export function CrSetupPage() {
  const qc = useQueryClient();
  const { data: allowedList, isError, isLoading, refetch } = useQuery({
    queryKey: ['cr-list'],
    queryFn: async () => {
      const data = await apiFetch<{ courses: CourseItem[] }>('/courses/cr-list');
      return data.courses;
    },
    retry: false,
  });

  const allowed = !isError && allowedList != null;
  const list = allowedList ?? [];

  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [teacherId, setTeacherId] = useState('');

  const [editItem, setEditItem] = useState<CourseItem | null>(null);
  const [eName, setEName] = useState('');
  const [eCode, setECode] = useState('');
  const [eTeacher, setETeacher] = useState('');

  const [teacherModalFor, setTeacherModalFor] = useState<CourseItem | null>(null);
  const [teacherQ, setTeacherQ] = useState('');
  const [teacherHits, setTeacherHits] = useState<TeacherHit[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(false);

  const [studentQ, setStudentQ] = useState('');
  const [studentHits, setStudentHits] = useState<StudentHit[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);

  const addMut = useMutation({
    mutationFn: async () => {
      const tid = teacherId.trim();
      await apiFetch('/courses', {
        method: 'POST',
        json: {
          courseName: courseName.trim(),
          courseCode: courseCode.trim() || undefined,
          teacherStudentId: tid ? tid.toUpperCase() : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success('Offering added');
      setCourseName('');
      setCourseCode('');
      setTeacherId('');
      void qc.invalidateQueries({ queryKey: ['cr-list'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const saveEditMut = useMutation({
    mutationFn: async () => {
      if (!editItem) return;
      await apiFetch(`/courses/${editItem.id}`, {
        method: 'PUT',
        json: {
          courseName: eName.trim() || undefined,
          courseCode: eCode.trim() || undefined,
          teacherStudentId: eTeacher.trim() ? eTeacher.trim().toUpperCase() : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success('Updated');
      setEditItem(null);
      void qc.invalidateQueries({ queryKey: ['cr-list'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/courses/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Removed');
      void qc.invalidateQueries({ queryKey: ['cr-list'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  async function searchTeachers(q: string) {
    setTeacherQ(q);
    if (q.trim().length < 1) {
      setTeacherHits([]);
      return;
    }
    setTeacherLoading(true);
    try {
      const d = await apiFetch<{ teachers: TeacherHit[] }>(
        `/courses/teachers/search?q=${encodeURIComponent(q.trim())}`
      );
      setTeacherHits(d.teachers);
    } catch {
      setTeacherHits([]);
    } finally {
      setTeacherLoading(false);
    }
  }

  const assignTeacherMut = useMutation({
    mutationFn: async ({ offeringId, teacherStudentId }: { offeringId: string; teacherStudentId: string | null }) => {
      await apiFetch(`/courses/offerings/${offeringId}/teacher`, {
        method: 'PUT',
        json: { teacherStudentId },
      });
    },
    onSuccess: () => {
      toast.success('Teacher updated');
      setTeacherModalFor(null);
      setTeacherHits([]);
      setTeacherQ('');
      void qc.invalidateQueries({ queryKey: ['cr-list'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  async function searchStudents(q: string) {
    setStudentQ(q);
    if (q.trim().length < 1) {
      setStudentHits([]);
      return;
    }
    setStudentLoading(true);
    try {
      const d = await apiFetch<{ students: StudentHit[] }>(
        `/courses/students/search?q=${encodeURIComponent(q.trim())}`
      );
      setStudentHits(d.students);
    } catch {
      setStudentHits([]);
    } finally {
      setStudentLoading(false);
    }
  }

  const sectionMut = useMutation({
    mutationFn: async ({ studentId, section }: { studentId: string; section: string | null }) => {
      await apiFetch(`/courses/students/${studentId}/section`, {
        method: 'PUT',
        json: { section },
      });
    },
    onSuccess: () => {
      toast.success('Section updated');
      void searchStudents(studentQ);
    },
    onError: (e) => toast.error(String(e)),
  });

  if (isLoading) return <p className="text-app-subtle">Loading…</p>;
  if (!allowed) {
    return (
      <div>
        <PageHeader title="Class rep setup" subtitle="Only available for active class representatives." />
        <Card className="p-6">
          <p className="text-app-muted">
            You do not have access to CR class setup, or you are not a class rep for the active year.
          </p>
          <Link to="/assistant" className="mt-4 inline-block text-app-accent">
            Open assistant
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Class rep — cohort setup"
        subtitle="Same flows as mobile: manage offerings, assign teachers, student sections."
      />
      <Toolbar>
        <Button variant="secondary" onClick={() => refetch()}>
          Refresh
        </Button>
        <Link to="/assistant?q=I%20am%20a%20class%20rep.%20Help%20me%20with%20teacher%20assignments%20and%20cohort%20setup.">
          <Button variant="ghost" className="text-app-accent">
            Ask assistant
          </Button>
        </Link>
      </Toolbar>

      <Card className="mb-6 p-4">
        <h2 className="mb-3 font-semibold text-app-label">Add course for cohort</h2>
        <div className="space-y-3">
          <div>
            <Label>Course name</Label>
            <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} />
          </div>
          <div>
            <Label>Code (optional)</Label>
            <Input value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
          </div>
          <div>
            <Label>Teacher ID (optional)</Label>
            <Input value={teacherId} onChange={(e) => setTeacherId(e.target.value)} />
          </div>
          <Button onClick={() => addMut.mutate()} disabled={addMut.isPending || !courseName.trim()}>
            Add
          </Button>
        </div>
      </Card>

      <Card className="mb-6 p-4">
        <h2 className="mb-3 font-semibold text-app-label">Students — set section</h2>
        <Input
          value={studentQ}
          onChange={(e) => void searchStudents(e.target.value)}
          placeholder="Search student ID or name"
        />
        {studentLoading && <p className="mt-2 text-xs text-app-subtle">Searching…</p>}
        <ul className="mt-2 space-y-2">
          {studentHits.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-app-separator p-2 text-sm">
              <span className="text-app-label">
                {s.name} ({s.student_id})
              </span>
              <span className="text-app-subtle">sec: {s.section ?? '—'}</span>
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => sectionMut.mutate({ studentId: s.id, section: 'A' })}
              >
                Set A
              </Button>
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() => sectionMut.mutate({ studentId: s.id, section: null })}
              >
                Clear
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-app-muted">Your cohort offerings ({list.length})</h2>
      <div className="space-y-3">
        {list.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="font-medium text-app-label">{c.course_name}</div>
            <div className="text-sm text-app-subtle">
              {c.course_code ?? '—'} ·{' '}
              {c.teacher_name ? `${c.teacher_name} (${c.teacher_student_id})` : 'No teacher'}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" className="text-xs" onClick={() => setTeacherModalFor(c)}>
                Assign teacher
              </Button>
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => {
                  setEditItem(c);
                  setEName(c.course_name);
                  setECode(c.course_code ?? '');
                  setETeacher('');
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                className="text-xs text-app-destructive"
                onClick={() => {
                  if (confirm('Deactivate offering?')) deleteMut.mutate(c.id);
                }}
              >
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {teacherModalFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app-overlay p-4">
          <Card className="max-h-[80vh] w-full max-w-md overflow-y-auto p-6">
            <h3 className="font-semibold text-app-label">Assign teacher — {teacherModalFor.course_name}</h3>
            <Input
              className="mt-3"
              value={teacherQ}
              onChange={(e) => void searchTeachers(e.target.value)}
              placeholder="Search teacher…"
            />
            {teacherLoading && <p className="text-xs text-app-subtle">Searching…</p>}
            <ul className="mt-2 space-y-1">
              {teacherHits.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-app-fill"
                    onClick={() =>
                      assignTeacherMut.mutate({
                        offeringId: teacherModalFor.id,
                        teacherStudentId: t.student_id,
                      })
                    }
                  >
                    {t.name} ({t.student_id})
                  </button>
                </li>
              ))}
            </ul>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => assignTeacherMut.mutate({ offeringId: teacherModalFor.id, teacherStudentId: null })}
            >
              Clear teacher
            </Button>
            <Button className="ml-2" variant="ghost" onClick={() => setTeacherModalFor(null)}>
              Close
            </Button>
          </Card>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app-overlay p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="font-semibold text-app-label">Edit offering</h3>
            <div className="mt-3 space-y-2">
              <Input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Name" />
              <Input value={eCode} onChange={(e) => setECode(e.target.value)} placeholder="Code" />
              <Input
                value={eTeacher}
                onChange={(e) => setETeacher(e.target.value)}
                placeholder="Teacher ID (optional)"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => saveEditMut.mutate()} disabled={saveEditMut.isPending}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setEditItem(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
