import { useCallback, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Badge, Button, Card, Input, Label, PageHeader, Select, Toolbar } from '@/components/ui';

type YearRow = { id: string; name: string; start_date: string; end_date: string; is_active: boolean };
type OfferingRow = {
  id: string;
  course_name: string;
  course_code: string | null;
  department_name: string;
  year: number;
  section: string | null;
  teacher_name: string | null;
  teacher_student_id: string | null;
  is_active: boolean;
};
type Opt = { id: string; name: string };
type CatRow = { id: string; course_name: string; course_code: string | null };

function parseBulkCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const head = lines[0].toLowerCase();
  const start = head.includes('course_code') ? 1 : 0;
  const out: {
    courseCode: string;
    faculty: string;
    department: string;
    year: number;
    section?: string;
    teacherStudentId?: string;
  }[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 4) continue;
    const [courseCode, faculty, department, yearStr, section, teacherStudentId] = cols;
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year)) continue;
    const row: (typeof out)[number] = { courseCode, faculty, department, year };
    if (section) row.section = section;
    if (teacherStudentId) row.teacherStudentId = teacherStudentId;
    out.push(row);
  }
  return out;
}

export function CourseOfferingsPage() {
  const { data: years = [] } = useQuery({
    queryKey: ['admin', 'semesters'],
    queryFn: async () => {
      const d = await apiFetch<{ semesters: YearRow[] }>('/admin/semesters');
      return d.semesters;
    },
  });

  const [yearId, setYearId] = useState<string | null>(null);
  const activeOrFirst = (() => {
    const active = years.find((y) => y.is_active);
    return active?.id ?? years[0]?.id ?? null;
  })();

  const effectiveYearId = yearId ?? activeOrFirst;

  const { data: offerings = [], refetch: refetchOfferings } = useQuery({
    queryKey: ['admin', 'course-offerings', effectiveYearId],
    enabled: !!effectiveYearId,
    queryFn: async () => {
      const d = await apiFetch<{ offerings: OfferingRow[] }>(
        `/admin/course-offerings?academic_year_id=${encodeURIComponent(effectiveYearId!)}`
      );
      return d.offerings;
    },
  });

  const { data: faculties = [] } = useQuery({
    queryKey: ['structure', 'faculties'],
    queryFn: async () => {
      const d = await apiFetch<{ faculties: Opt[] }>('/structure/faculties');
      return d.faculties;
    },
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['admin', 'catalog'],
    queryFn: async () => {
      const d = await apiFetch<{ courses: CatRow[] }>('/admin/catalog/courses');
      return d.courses;
    },
  });

  const [createFacultyId, setCreateFacultyId] = useState<string>('');
  const { data: createDepartments = [] } = useQuery({
    queryKey: ['structure', 'departments', createFacultyId],
    enabled: !!createFacultyId,
    queryFn: async () => {
      const d = await apiFetch<{ departments: Opt[] }>(
        `/structure/departments?faculty_id=${encodeURIComponent(createFacultyId)}`
      );
      return d.departments;
    },
  });

  const [cCatalogId, setCCatalogId] = useState('');
  const [cDeptId, setCDeptId] = useState('');
  const [cYear, setCYear] = useState('5');
  const [cSection, setCSection] = useState('');
  const [cTeacher, setCTeacher] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const createOffering = useMutation({
    mutationFn: async () => {
      if (!effectiveYearId) throw new Error('Select an academic year');
      if (!cCatalogId.trim()) throw new Error('Select or enter a catalog course');
      const y = parseInt(cYear, 10);
      if (!Number.isFinite(y)) throw new Error('Enter cohort year');
      if (!cDeptId) throw new Error('Select department');
      await apiFetch('/admin/course-offerings', {
        method: 'POST',
        json: {
          courseId: cCatalogId.trim(),
          academicYearId: effectiveYearId,
          departmentId: cDeptId,
          year: y,
          section: cSection.trim() || null,
          teacherStudentId: cTeacher.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success('Offering created');
      setCCatalogId('');
      setCTeacher('');
      setShowCreate(false);
      void refetchOfferings();
    },
    onError: (e) => toast.error(String(e)),
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      const parsed = parseBulkCsv(bulkText);
      if (!parsed.length) throw new Error('No valid CSV rows');
      return apiFetch<{ created: number; skipped: number }>('/admin/course-offerings/bulk', {
        method: 'POST',
        json: { offerings: parsed },
      });
    },
    onSuccess: (r) => {
      toast.success(`Created ${r.created}, skipped ${r.skipped}`);
      setBulkText('');
      void refetchOfferings();
    },
    onError: (e) => toast.error(String(e)),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/admin/course-offerings/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Offering deactivated');
      void refetchOfferings();
    },
    onError: (e) => toast.error(String(e)),
  });

  const onDeactivate = useCallback(
    (id: string) => {
      if (!confirm('Deactivate this offering? It will no longer be bookable.')) return;
      deleteMut.mutate(id);
    },
    [deleteMut]
  );

  return (
    <div>
      <PageHeader
        title="Course offerings"
        subtitle="Per academic year. Set the active year under Academic years."
      />

      <Card className="mb-6 p-4">
        <Label className="!mb-2">Academic year</Label>
        <div className="flex flex-col gap-2">
          {years.map((y) => (
            <button
              key={y.id}
              type="button"
              onClick={() => setYearId(y.id)}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                (effectiveYearId === y.id
                  ? 'border-app-accent/40 bg-app-accent-muted'
                  : 'border-app-separator bg-app-secondary/40')
              }`}
            >
              <span className={y.is_active ? 'text-app-success' : 'text-app-subtle'}>{y.is_active ? '●' : '○'}</span>
              <div>
                <div className="font-medium text-app-label">{y.name}</div>
                <div className="text-xs text-app-subtle">
                  {y.start_date} → {y.end_date}
                </div>
              </div>
            </button>
          ))}
        </div>
        {years.length === 0 && <p className="text-sm text-app-subtle">No academic years yet.</p>}
      </Card>

      <Toolbar>
        <Button variant="secondary" onClick={() => { setShowCreate(!showCreate); setShowBulk(false); }}>
          {showCreate ? 'Close' : 'New offering'}
        </Button>
        <Button variant="secondary" onClick={() => { setShowBulk(!showBulk); setShowCreate(false); }}>
          {showBulk ? 'Close' : 'Bulk import'}
        </Button>
      </Toolbar>

      {showBulk && effectiveYearId && (
        <Card className="mb-6 p-5">
          <h2 className="mb-2 font-semibold text-app-label">Bulk import (CSV)</h2>
          <p className="mb-2 text-xs text-app-subtle">
            course_code,faculty,department,year[,section,teacher_id]
          </p>
          <textarea
            className="mb-3 min-h-[88px] w-full rounded-lg border border-app-separator bg-app-page/80 px-3 py-2 text-sm"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="CS401,Faculty of Computing,Software Engineering,5,A,TCH001"
          />
          <Button onClick={() => bulkMut.mutate()} disabled={bulkMut.isPending}>
            Import offerings
          </Button>
        </Card>
      )}

      {showCreate && effectiveYearId && (
        <Card className="mb-6 p-5">
          <h2 className="mb-2 font-semibold text-app-label">Create offering</h2>
          <p className="mb-3 text-xs text-app-subtle">
            Pick a catalog course and department, or paste a catalog UUID below.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Catalog course</Label>
              <Select value={cCatalogId} onChange={(e) => setCCatalogId(e.target.value)}>
                <option value="">Select from catalog…</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_name}
                    {c.course_code ? ` (${c.course_code})` : ''}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-app-subtle">Or paste catalog course UUID:</p>
              <Input
                className="mt-1 font-mono text-xs"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={cCatalogId}
                onChange={(e) => setCCatalogId(e.target.value)}
              />
            </div>
            <div>
              <Label>Faculty</Label>
              <Select
                value={createFacultyId}
                onChange={(e) => {
                  setCreateFacultyId(e.target.value);
                  setCDeptId('');
                }}
              >
                <option value="">Select faculty…</option>
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select
                value={cDeptId}
                onChange={(e) => setCDeptId(e.target.value)}
                disabled={!createFacultyId}
              >
                <option value="">Select department…</option>
                {createDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Cohort year</Label>
                <Input value={cYear} onChange={(e) => setCYear(e.target.value)} />
              </div>
              <div>
                <Label>Section (optional)</Label>
                <Input value={cSection} onChange={(e) => setCSection(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Teacher ID (optional)</Label>
              <Input value={cTeacher} onChange={(e) => setCTeacher(e.target.value)} />
            </div>
          </div>
          <Button className="mt-4" onClick={() => createOffering.mutate()} disabled={createOffering.isPending}>
            Create offering
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-app-separator px-4 py-3 text-sm font-medium text-app-label">
          Offerings ({offerings.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-app-separator text-xs text-app-subtle">
                <th className="px-4 py-2">Course</th>
                <th className="px-4 py-2">Teacher</th>
                <th className="px-4 py-2">Dept · year</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => (
                <tr key={o.id} className="border-b border-app-separator/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-app-label">{o.course_name}</div>
                    <div className="text-xs text-app-subtle">{o.course_code ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-app-muted">
                    {o.teacher_name ? `${o.teacher_name} (${o.teacher_student_id})` : '—'}
                  </td>
                  <td className="px-4 py-3 text-app-muted">
                    {o.department_name} · Y{o.year}
                    {o.section ? ` · ${o.section}` : ''}
                    {!o.is_active && (
                      <span className="ml-2 inline-block">
                        <Badge tone="warn">Inactive</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" className="text-app-destructive" onClick={() => onDeactivate(o.id)}>
                      Deactivate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {effectiveYearId && offerings.length === 0 && (
          <p className="p-6 text-sm text-app-subtle">No offerings for this year.</p>
        )}
      </Card>
    </div>
  );
}
