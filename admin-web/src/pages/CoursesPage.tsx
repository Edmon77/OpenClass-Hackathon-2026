import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Badge, Button, Card, Input, Label, PageHeader, Toolbar } from '@/components/ui';

type CourseRow = {
  id: string;
  course_name: string;
  course_code: string | null;
  faculty_name: string;
  department: string;
  year: number;
  class_section: string;
  teacher_name: string | null;
  teacher_student_id: string | null;
  semester_name: string;
  is_active: boolean;
};

function parseCourseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const head = lines[0].toLowerCase();
  const start = head.includes('course_name') || head.includes('coursename') ? 1 : 0;
  const out: {
    courseName: string;
    courseCode?: string;
    teacherStudentId?: string;
    faculty: string;
    department: string;
    year: number;
    classSection?: string;
  }[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 5) continue;
    const [courseName, faculty, department, yearStr, classSection, teacherStudentId, courseCode] = cols;
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year)) continue;
    const row: (typeof out)[number] = { courseName, faculty, department, year, classSection: classSection || '' };
    if (teacherStudentId) row.teacherStudentId = teacherStudentId;
    if (courseCode) row.courseCode = courseCode;
    out.push(row);
  }
  return out;
}

export function CoursesPage() {
  const qc = useQueryClient();
  const { data: courses = [] } = useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: async () => {
      const data = await apiFetch<{ courses: CourseRow[] }>('/admin/courses');
      return data.courses;
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('');
  const [cTeacher, setCTeacher] = useState('');
  const [cFaculty, setCFaculty] = useState('Faculty of Computing');
  const [cDept, setCDept] = useState('Software Engineering');
  const [cYear, setCYear] = useState('');
  const [cClass, setCClass] = useState('');
  const [bulkText, setBulkText] = useState('');

  const [editCourse, setEditCourse] = useState<CourseRow | null>(null);
  const [eName, setEName] = useState('');
  const [eCode, setECode] = useState('');
  const [eTeacher, setETeacher] = useState('');
  const [eFaculty, setEFaculty] = useState('');
  const [eDept, setEDept] = useState('');
  const [eYear, setEYear] = useState('');
  const [eClass, setEClass] = useState('');

  const createMut = useMutation({
    mutationFn: async () => {
      const y = parseInt(cYear, 10);
      if (!cName.trim() || !cDept.trim() || !Number.isFinite(y)) {
        throw new Error('Course name, department, and year are required');
      }
      await apiFetch('/admin/courses', {
        method: 'POST',
        json: {
          courseName: cName.trim(),
          courseCode: cCode.trim() || undefined,
          teacherStudentId: cTeacher.trim() ? cTeacher.trim().toUpperCase() : undefined,
          faculty: cFaculty.trim(),
          department: cDept.trim(),
          year: y,
          classSection: cClass.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success('Course created');
      setCName('');
      setCCode('');
      setCTeacher('');
      setCYear('');
      setCClass('');
      setShowCreate(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const saveEditMut = useMutation({
    mutationFn: async () => {
      if (!editCourse) return;
      const y = parseInt(eYear, 10);
      await apiFetch(`/admin/courses/${editCourse.id}`, {
        method: 'PUT',
        json: {
          courseName: eName.trim() || undefined,
          courseCode: eCode.trim() || undefined,
          teacherStudentId: eTeacher.trim() ? eTeacher.trim().toUpperCase() : '',
          faculty: eFaculty.trim() || undefined,
          department: eDept.trim() || undefined,
          year: Number.isFinite(y) ? y : undefined,
          classSection: eClass.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success('Course updated');
      setEditCourse(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/admin/courses/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Course deactivated');
      void qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      const parsed = parseCourseCsv(bulkText);
      if (!parsed.length) throw new Error('No valid rows');
      return apiFetch<{ created: number; skipped: number }>('/admin/courses/bulk', {
        method: 'POST',
        json: { courses: parsed },
      });
    },
    onSuccess: (r) => {
      toast.success(`Created ${r.created}, skipped ${r.skipped}`);
      setBulkText('');
      void qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  function openEdit(c: CourseRow) {
    setEditCourse(c);
    setEName(c.course_name);
    setECode(c.course_code ?? '');
    setETeacher(c.teacher_student_id ?? '');
    setEFaculty(c.faculty_name || 'Faculty of Computing');
    setEDept(c.department);
    setEYear(String(c.year));
    setEClass(c.class_section);
  }

  return (
    <div>
      <PageHeader
        title="Courses (quick)"
        subtitle="Creates catalog + offering in one step. Faculty and department names must match your database exactly."
      />

      <Toolbar>
        <Button variant="secondary" onClick={() => { setShowCreate(!showCreate); setShowBulk(false); }}>
          {showCreate ? 'Close' : 'New course'}
        </Button>
        <Button variant="secondary" onClick={() => { setShowBulk(!showBulk); setShowCreate(false); }}>
          {showBulk ? 'Close' : 'Bulk import'}
        </Button>
      </Toolbar>

      {showCreate && (
        <Card className="mb-6 p-5">
          <h2 className="mb-3 font-semibold text-app-label">Create course</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Course name</Label>
              <Input value={cName} onChange={(e) => setCName(e.target.value)} />
            </div>
            <div>
              <Label>Course code (optional)</Label>
              <Input value={cCode} onChange={(e) => setCCode(e.target.value)} />
            </div>
            <div>
              <Label>Faculty (exact name)</Label>
              <Input value={cFaculty} onChange={(e) => setCFaculty(e.target.value)} />
            </div>
            <div>
              <Label>Department (exact name)</Label>
              <Input value={cDept} onChange={(e) => setCDept(e.target.value)} />
            </div>
            <div>
              <Label>Teacher ID (optional)</Label>
              <Input value={cTeacher} onChange={(e) => setCTeacher(e.target.value)} />
            </div>
            <div>
              <Label>Year</Label>
              <Input value={cYear} onChange={(e) => setCYear(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Section (optional)</Label>
              <Input value={cClass} onChange={(e) => setCClass(e.target.value)} />
            </div>
          </div>
          <Button className="mt-4" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            Create course
          </Button>
        </Card>
      )}

      {showBulk && (
        <Card className="mb-6 p-5">
          <h2 className="mb-2 font-semibold text-app-label">Bulk import (CSV)</h2>
          <p className="mb-2 text-xs text-app-subtle">
            course_name,faculty,department,year,section[,teacher_id,code]
          </p>
          <textarea
            className="mb-3 min-h-[88px] w-full rounded-lg border border-app-separator bg-app-page/80 px-3 py-2 text-sm"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Database Systems,Faculty of Computing,Software Engineering,5,A,TCH001,CS401"
          />
          <Button onClick={() => bulkMut.mutate()} disabled={bulkMut.isPending}>
            Import courses
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-app-separator px-4 py-3 text-sm font-medium text-app-label">
          All courses ({courses.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-app-separator text-xs text-app-subtle">
                <th className="px-4 py-2">Course</th>
                <th className="px-4 py-2">Teacher</th>
                <th className="px-4 py-2">Dept · year · section</th>
                <th className="px-4 py-2">Year (sem)</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-b border-app-separator/80 hover:bg-app-fill/30">
                  <td className="px-4 py-3">
                    <button type="button" className="text-left" onClick={() => openEdit(c)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-app-label">{c.course_name}</span>
                        {!c.is_active && <Badge tone="danger">Inactive</Badge>}
                      </div>
                      <div className="text-xs text-app-subtle">{c.course_code ?? '—'}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-app-muted">
                    {c.teacher_name ? `${c.teacher_name} (${c.teacher_student_id})` : '—'}
                  </td>
                  <td className="px-4 py-3 text-app-muted">
                    {c.department} · Y{c.year} · {c.class_section}
                  </td>
                  <td className="px-4 py-3 text-app-subtle">{c.semester_name}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      className="text-app-destructive"
                      onClick={() => {
                        if (confirm('Deactivate this course?')) deleteMut.mutate(c.id);
                      }}
                    >
                      Deactivate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {courses.length === 0 && <p className="p-6 text-sm text-app-subtle">No courses yet.</p>}
      </Card>

      {editCourse && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-app-overlay p-4 sm:items-center">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="font-display text-lg font-semibold text-app-label">Edit course</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Course name</Label>
                <Input value={eName} onChange={(e) => setEName(e.target.value)} />
              </div>
              <div>
                <Label>Course code</Label>
                <Input value={eCode} onChange={(e) => setECode(e.target.value)} />
              </div>
              <div>
                <Label>Faculty</Label>
                <Input value={eFaculty} onChange={(e) => setEFaculty(e.target.value)} />
              </div>
              <div>
                <Label>Department</Label>
                <Input value={eDept} onChange={(e) => setEDept(e.target.value)} />
              </div>
              <div>
                <Label>Teacher ID (empty to clear)</Label>
                <Input value={eTeacher} onChange={(e) => setETeacher(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Year</Label>
                  <Input value={eYear} onChange={(e) => setEYear(e.target.value)} />
                </div>
                <div>
                  <Label>Section</Label>
                  <Input value={eClass} onChange={(e) => setEClass(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button onClick={() => saveEditMut.mutate()} disabled={saveEditMut.isPending}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setEditCourse(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
