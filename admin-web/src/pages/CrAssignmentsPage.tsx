import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';

type YearRow = { id: string; name: string; is_active: boolean };
type Opt = { id: string; name: string };
type UserHit = {
  id: string;
  student_id: string;
  studentId?: string;
  name: string;
  year: number | null;
  section: string | null;
  role?: string;
};
type CrRow = {
  id: string;
  user_name: string;
  student_id: string;
  department_name: string;
  year: number;
  section: string | null;
  is_active: boolean;
};

export function CrAssignmentsPage() {
  const qc = useQueryClient();
  const { data: years = [] } = useQuery({
    queryKey: ['admin', 'semesters'],
    queryFn: async () => {
      const s = await apiFetch<{ semesters: YearRow[] }>('/admin/semesters');
      return s.semesters;
    },
  });

  const { data: faculties = [] } = useQuery({
    queryKey: ['structure', 'faculties'],
    queryFn: async () => {
      const d = await apiFetch<{ faculties: Opt[] }>('/structure/faculties');
      return d.faculties;
    },
  });

  const [crYearId, setCrYearId] = useState<string | null>(null);
  const [selFacultyId, setSelFacultyId] = useState<string | null>(null);
  const [selDeptId, setSelDeptId] = useState<string | null>(null);
  const [crYearNum, setCrYearNum] = useState('');
  const [crSection, setCrSection] = useState('');
  const [studentQ, setStudentQ] = useState('');
  const [studentHits, setStudentHits] = useState<UserHit[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UserHit | null>(null);

  const defaultYearId =
    crYearId ??
    years.find((x) => x.is_active)?.id ??
    years[0]?.id ??
    null;

  const { data: departments = [] } = useQuery({
    queryKey: ['structure', 'departments', selFacultyId],
    enabled: !!selFacultyId,
    queryFn: async () => {
      const d = await apiFetch<{ departments: Opt[] }>(
        `/structure/departments?faculty_id=${encodeURIComponent(selFacultyId!)}`
      );
      return d.departments;
    },
  });

  const { data: crList = [], refetch: refetchCr } = useQuery({
    queryKey: ['admin', 'cr-assignments', defaultYearId, selDeptId],
    enabled: !!defaultYearId && !!selDeptId,
    queryFn: async () => {
      const d = await apiFetch<{ assignments: CrRow[] }>(
        `/admin/cr-assignments?academic_year_id=${encodeURIComponent(defaultYearId!)}&department_id=${encodeURIComponent(selDeptId!)}`
      );
      return d.assignments ?? [];
    },
  });

  const searchStudents = useCallback(
    async (q: string) => {
      setStudentQ(q);
      setSelectedStudent(null);
      if (q.trim().length < 2 || !selDeptId) {
        setStudentHits([]);
        return;
      }
      setStudentLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('department_id', selDeptId);
        if (crYearNum.trim()) params.set('year', crYearNum.trim());
        params.set('search', q.trim());
        const d = await apiFetch<{ users: UserHit[] }>(`/admin/users?${params.toString()}`);
        setStudentHits((d.users ?? []).slice(0, 20));
      } catch {
        setStudentHits([]);
      } finally {
        setStudentLoading(false);
      }
    },
    [selDeptId, crYearNum]
  );

  const createMut = useMutation({
    mutationFn: async () => {
      if (!defaultYearId || !selDeptId || !selectedStudent || !crYearNum.trim()) {
        throw new Error('Select year, department, student, and cohort year');
      }
      const y = parseInt(crYearNum, 10);
      if (!Number.isFinite(y)) throw new Error('Invalid cohort year');
      await apiFetch('/admin/cr-assignments', {
        method: 'POST',
        json: {
          userId: selectedStudent.id,
          academicYearId: defaultYearId,
          departmentId: selDeptId,
          year: y,
          section: crSection.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success('Class representative assigned');
      setSelectedStudent(null);
      setStudentQ('');
      setStudentHits([]);
      void refetchCr();
      void qc.invalidateQueries({ queryKey: ['admin', 'cr-assignments'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div>
      <PageHeader
        title="CR assignments"
        subtitle="Assign a student as class representative for a department cohort (year + optional section)."
      />

      <Card className="space-y-6 p-5">
        <div>
          <Label className="!mb-2">Academic year</Label>
          <div className="flex flex-wrap gap-2">
            {years.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCrYearId(s.id)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  (crYearId ?? defaultYearId) === s.id
                    ? 'bg-app-campus text-white'
                    : 'bg-app-fill text-app-label'
                }`}
              >
                {s.name}
                {s.is_active ? ' (active)' : ''}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="!mb-2">Faculty</Label>
          <div className="flex flex-wrap gap-2">
            {faculties.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelFacultyId(f.id);
                  setSelDeptId(null);
                }}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  selFacultyId === f.id ? 'bg-app-campus text-white' : 'bg-app-fill text-app-label'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="!mb-2">Department</Label>
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelDeptId(d.id)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  selDeptId === d.id ? 'bg-app-campus text-white' : 'bg-app-fill text-app-label'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Cohort year (e.g. 5)</Label>
            <Input value={crYearNum} onChange={(e) => setCrYearNum(e.target.value)} />
          </div>
          <div>
            <Label>Section (optional)</Label>
            <Input value={crSection} onChange={(e) => setCrSection(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Search student (min 2 characters)</Label>
          <Input
            value={studentQ}
            onChange={(e) => void searchStudents(e.target.value)}
            placeholder="ID or name"
          />
          {studentLoading && <p className="mt-2 text-xs text-app-subtle">Searching…</p>}
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-app-separator">
            {studentHits.map((s) => {
              const sid = s.student_id ?? s.studentId ?? '';
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(s)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                      selectedStudent?.id === s.id ? 'bg-app-accent-muted text-app-accent' : 'hover:bg-app-fill'
                    }`}
                  >
                    <span className="text-app-subtle">{selectedStudent?.id === s.id ? '✓' : '○'}</span>
                    <span>
                      <span className="text-app-label">{s.name}</span>
                      <span className="ml-2 text-xs text-app-subtle">
                        {sid} · yr {s.year ?? '?'} · {s.section ?? '—'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {selectedStudent && (
            <p className="mt-2 rounded-lg bg-app-accent-muted px-3 py-2 text-sm text-app-accent">
              Selected: {selectedStudent.name} (
              {selectedStudent.student_id ?? selectedStudent.studentId})
            </p>
          )}
        </div>

        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          Assign CR
        </Button>
      </Card>

      {crList.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-app-separator px-4 py-3 text-sm font-medium text-app-label">
            Existing CRs ({crList.length})
          </div>
          <ul className="divide-y divide-app-separator">
            {crList.map((cr) => (
              <li key={cr.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`h-2 w-2 rounded-full ${cr.is_active ? 'bg-app-success' : 'bg-app-subtle'}`}
                />
                <div>
                  <div className="font-medium text-app-label">{cr.user_name}</div>
                  <div className="text-xs text-app-subtle">
                    {cr.student_id} · {cr.department_name} · yr {cr.year}
                    {cr.section ? ` · sec ${cr.section}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
