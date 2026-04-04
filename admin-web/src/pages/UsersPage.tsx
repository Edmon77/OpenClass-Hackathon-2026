import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Badge, Button, Card, Input, Label, PageHeader, Select, TextArea, Toolbar } from '@/components/ui';

type UserRow = {
  id: string;
  studentId: string;
  name: string;
  role: string;
  department_name?: string | null;
  faculty_name?: string | null;
  faculty_id?: string | null;
  department_id?: string | null;
  year: number | null;
  section?: string | null;
  isActive: boolean;
  forcePasswordChange?: boolean;
};

type Opt = { id: string; name: string };

function parseUserCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const split = (line: string) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.includes('student_id') || header.includes('studentid');
  const idx = (name: string) => header.indexOf(name);
  const start = hasHeader ? 1 : 0;

  type BulkRow = {
    studentId: string;
    name: string;
    password: string;
    role?: 'student' | 'teacher' | 'admin';
    gender?: string;
    program?: string;
    faculty?: string;
    department?: string;
    fieldOfStudy?: string;
    admissionType?: string;
    year?: number;
    section?: string;
  };
  const out: BulkRow[] = [];
  const extended = hasHeader && (idx('first_name') >= 0 || idx('firstname') >= 0);

  for (let i = start; i < lines.length; i++) {
    const cols = split(lines[i]);
    if (extended && hasHeader) {
      const g = (k: string) => {
        const j = idx(k);
        return j >= 0 ? cols[j] : '';
      };
      const sid = g('student_id') || g('studentid');
      const fn = g('first_name') || g('firstname');
      const father = g('father_name') || g('fathername');
      const name = [fn, father].filter(Boolean).join(' ').trim() || g('name');
      const password = g('password');
      if (!sid || !name || !password) continue;
      const row: BulkRow = { studentId: sid, name, password };
      const r = g('role');
      if (r && ['student', 'teacher', 'admin'].includes(r)) row.role = r as BulkRow['role'];
      const yRaw = g('year');
      if (yRaw && /^\d+$/.test(yRaw)) row.year = parseInt(yRaw, 10);
      const gen = g('gender');
      if (gen) row.gender = gen;
      const prog = g('program');
      if (prog) row.program = prog;
      const fac = g('faculty');
      if (fac) row.faculty = fac;
      const dep = g('department');
      if (dep) row.department = dep;
      const fos = g('field_of_study') || g('fieldofstudy');
      if (fos) row.fieldOfStudy = fos;
      const adm = g('admission_type') || g('admissiontype');
      if (adm) row.admissionType = adm;
      const sec = g('section');
      if (sec) row.section = sec;
      out.push(row);
      continue;
    }

    if (cols.length < 3) continue;
    const [studentId, name, password, role, faculty, department, year, section] = cols;
    const row: BulkRow = { studentId, name, password };
    if (role && ['student', 'teacher', 'admin'].includes(role)) row.role = role as BulkRow['role'];
    if (faculty) row.faculty = faculty;
    if (department) row.department = department;
    if (year && /^\d+$/.test(year)) row.year = parseInt(year, 10);
    if (section) row.section = section;
    out.push(row);
  }
  return out;
}

export function UsersPage() {
  const qc = useQueryClient();
  const { data: faculties = [] } = useQuery({
    queryKey: ['structure', 'faculties'],
    queryFn: async () => {
      const d = await apiFetch<{ faculties: Opt[] }>('/structure/faculties');
      return d.faculties;
    },
  });

  const [selFacultyId, setSelFacultyId] = useState<string | null>(null);
  const [selDeptId, setSelDeptId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState('');
  const [searchQ, setSearchQ] = useState('');

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

  const filterKey = [selFacultyId, selDeptId, filterYear, searchQ] as const;
  const { data: userResult, refetch: refetchUsers } = useQuery({
    queryKey: ['admin', 'users', ...filterKey],
    enabled: !!(selDeptId || selFacultyId || searchQ.trim()),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selDeptId) params.set('department_id', selDeptId);
      else if (selFacultyId) params.set('faculty_id', selFacultyId);
      const y = filterYear.trim() ? parseInt(filterYear, 10) : null;
      if (y != null && Number.isFinite(y)) params.set('year', String(y));
      const q = searchQ.trim();
      if (q) params.set('search', q);
      return apiFetch<{ users: UserRow[]; total: number }>(`/admin/users?${params.toString()}`);
    },
  });

  const users = userResult?.users ?? [];
  const total = userResult?.total ?? 0;

  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [newFacultyId, setNewFacultyId] = useState<string | null>(null);
  const [newDeptId, setNewDeptId] = useState<string | null>(null);
  const [newYear, setNewYear] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newProgram, setNewProgram] = useState('');
  const [newFieldOfStudy, setNewFieldOfStudy] = useState('');
  const [newAdmissionType, setNewAdmissionType] = useState('');
  const [bulkText, setBulkText] = useState('');

  const { data: newDeptList = [] } = useQuery({
    queryKey: ['structure', 'departments', 'new', newFacultyId],
    enabled: !!newFacultyId,
    queryFn: async () => {
      const d = await apiFetch<{ departments: Opt[] }>(
        `/structure/departments?faculty_id=${encodeURIComponent(newFacultyId!)}`
      );
      return d.departments;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const year = newYear.trim() ? parseInt(newYear, 10) : undefined;
      await apiFetch('/admin/users', {
        method: 'POST',
        json: {
          studentId: newStudentId.trim().toUpperCase(),
          name: newName.trim(),
          password: newPassword,
          role: newRole,
          facultyId: newFacultyId ?? undefined,
          departmentId: newDeptId ?? undefined,
          gender: newGender.trim() || undefined,
          program: newProgram.trim() || undefined,
          fieldOfStudy: newFieldOfStudy.trim() || undefined,
          admissionType: newAdmissionType.trim() || undefined,
          year: Number.isFinite(year!) ? year : undefined,
          section: newSection.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success('User created');
      setNewStudentId('');
      setNewName('');
      setNewPassword('');
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      const parsed = parseUserCsv(bulkText);
      if (!parsed.length) throw new Error('No valid rows');
      return apiFetch<{ created: number; updated: number }>('/admin/users/bulk', {
        method: 'POST',
        json: { users: parsed },
      });
    },
    onSuccess: (r) => {
      toast.success(`Created ${r.created}, updated ${r.updated}`);
      setBulkText('');
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [eName, setEName] = useState('');
  const [eRole, setERole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [eFacultyForDept, setEFacultyForDept] = useState<string | null>(null);
  const [eDeptId, setEDeptId] = useState<string | null>(null);
  const [eYear, setEYear] = useState('');
  const [eSection, setESection] = useState('');
  const [ePassword, setEPassword] = useState('');
  const [eActive, setEActive] = useState(true);
  const [eForceChange, setEForceChange] = useState(false);

  const { data: editDepartments = [] } = useQuery({
    queryKey: ['structure', 'departments', 'edit', eFacultyForDept],
    enabled: !!editUser && !!eFacultyForDept,
    queryFn: async () => {
      const d = await apiFetch<{ departments: Opt[] }>(
        `/structure/departments?faculty_id=${encodeURIComponent(eFacultyForDept!)}`
      );
      return d.departments;
    },
  });

  const openEdit = useCallback((u: UserRow) => {
    setEditUser(u);
    setEName(u.name);
    setERole(u.role as 'student' | 'teacher' | 'admin');
    setEFacultyForDept(u.faculty_id ?? null);
    setEDeptId(u.department_id ?? null);
    setEYear(u.year != null ? String(u.year) : '');
    setESection(u.section ?? '');
    setEPassword('');
    setEActive(u.isActive);
    setEForceChange(u.forcePasswordChange ?? false);
  }, []);

  useEffect(() => {
    if (editUser && !eFacultyForDept && faculties.length === 1) {
      setEFacultyForDept(faculties[0].id);
    }
  }, [editUser, eFacultyForDept, faculties]);

  const saveEditMut = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const y = eYear.trim() ? parseInt(eYear, 10) : null;
      await apiFetch(`/admin/users/${editUser.id}`, {
        method: 'PUT',
        json: {
          name: eName.trim() || undefined,
          role: eRole,
          departmentId: eDeptId,
          year: y != null && Number.isFinite(y) ? y : null,
          section: eSection.trim() || null,
          isActive: eActive,
          forcePasswordChange: eForceChange,
          password: ePassword.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success('User updated');
      setEditUser(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  function roleTone(r: string): 'danger' | 'info' | 'neutral' {
    if (r === 'admin') return 'danger';
    if (r === 'teacher') return 'info';
    return 'neutral';
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Filter by faculty and/or department, optional year, then search. At least one filter is required by the API."
      />

      <Card className="mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-app-label">Find users</h2>
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
                selFacultyId === f.id ? 'bg-app-campus text-white' : 'bg-app-fill text-app-label hover:bg-app-fill'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
        {selFacultyId && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelDeptId(null)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                selDeptId === null ? 'bg-app-campus text-white' : 'bg-app-fill text-app-label'
              }`}
            >
              All departments
            </button>
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
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <Label>Year (optional)</Label>
            <Input value={filterYear} onChange={(e) => setFilterYear(e.target.value)} placeholder="e.g. 3" />
          </div>
          <div>
            <Label>Search ID or name</Label>
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search…" />
          </div>
        </div>
        <Button className="mt-3" onClick={() => refetchUsers()}>
          Apply filter
        </Button>
        <p className="mt-2 text-xs text-app-subtle">{total} user(s) match</p>
      </Card>

      <Toolbar>
        <Button variant="secondary" onClick={() => { setShowCreate(!showCreate); setShowBulk(false); }}>
          {showCreate ? 'Close' : 'New user'}
        </Button>
        <Button variant="secondary" onClick={() => { setShowBulk(!showBulk); setShowCreate(false); }}>
          {showBulk ? 'Close' : 'Bulk import'}
        </Button>
      </Toolbar>

      {showCreate && (
        <Card className="mb-6 p-5">
          <h2 className="mb-3 font-semibold text-app-label">Create user</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Student / staff ID</Label>
              <Input value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)} />
            </div>
            <div>
              <Label>Full name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['student', 'teacher', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setNewRole(r)}
                className={`rounded-full px-3 py-1 text-sm capitalize ${
                  newRole === r ? 'bg-app-campus text-white' : 'bg-app-fill'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {faculties.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setNewFacultyId(f.id);
                  setNewDeptId(null);
                }}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  newFacultyId === f.id ? 'bg-app-campus text-white' : 'bg-app-fill'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
          {newFacultyId && (
            <div className="mt-2 flex flex-wrap gap-2">
              {newDeptList.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setNewDeptId(d.id)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    newDeptId === d.id ? 'bg-app-campus text-white' : 'bg-app-fill'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <Label>Year</Label>
              <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} />
            </div>
            <div>
              <Label>Section</Label>
              <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} />
            </div>
            <div>
              <Label>Gender</Label>
              <Input value={newGender} onChange={(e) => setNewGender(e.target.value)} />
            </div>
            <div>
              <Label>Program</Label>
              <Input value={newProgram} onChange={(e) => setNewProgram(e.target.value)} />
            </div>
            <div>
              <Label>Field of study</Label>
              <Input value={newFieldOfStudy} onChange={(e) => setNewFieldOfStudy(e.target.value)} />
            </div>
            <div>
              <Label>Admission type</Label>
              <Input value={newAdmissionType} onChange={(e) => setNewAdmissionType(e.target.value)} />
            </div>
          </div>
          <Button className="mt-4" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            Create user
          </Button>
        </Card>
      )}

      {showBulk && (
        <Card className="mb-6 p-5">
          <h2 className="mb-2 font-semibold text-app-label">Bulk import</h2>
          <p className="mb-2 text-xs text-app-subtle">
            student_id,name,password[,role,faculty,department,year,section] — or extended CSV with headers.
          </p>
          <TextArea rows={6} value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
          <Button className="mt-3" onClick={() => bulkMut.mutate()} disabled={bulkMut.isPending}>
            Import
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-app-separator px-4 py-3 text-sm font-medium text-app-label">
          Results ({users.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-app-separator text-xs text-app-subtle">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Cohort</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="cursor-pointer border-b border-app-separator/80 hover:bg-app-fill/40"
                  onClick={() => openEdit(u)}
                >
                  <td className="px-4 py-3 font-medium text-app-label">{u.name}</td>
                  <td className="px-4 py-3 text-app-muted">{u.studentId}</td>
                  <td className="px-4 py-3">
                    <Badge tone={roleTone(u.role)}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-app-muted">{u.department_name ?? '—'}</td>
                  <td className="px-4 py-3 text-app-muted">
                    {u.year != null ? `Y${u.year}` : '—'}
                    {u.section ? ` · ${u.section}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!(selDeptId || selFacultyId || searchQ.trim()) && (
          <p className="p-6 text-sm text-app-subtle">Select a faculty, department, or enter a search term to load users.</p>
        )}
        {selDeptId || selFacultyId || searchQ.trim() ? (
          users.length === 0 ? (
            <p className="p-6 text-sm text-app-subtle">No users match.</p>
          ) : null
        ) : null}
      </Card>

      {editUser && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-app-overlay p-4 sm:items-center">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="font-display text-lg font-semibold text-app-label">Edit {editUser.studentId}</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={eName} onChange={(e) => setEName(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                {(['student', 'teacher', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setERole(r)}
                    className={`rounded-full px-3 py-1 text-sm capitalize ${
                      eRole === r ? 'bg-app-campus text-white' : 'bg-app-fill'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div>
                <Label>Faculty (for department list)</Label>
                <Select
                  value={eFacultyForDept ?? ''}
                  onChange={(e) => {
                    setEFacultyForDept(e.target.value || null);
                    setEDeptId(null);
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
                  value={eDeptId ?? ''}
                  onChange={(e) => setEDeptId(e.target.value || null)}
                  disabled={!eFacultyForDept}
                >
                  <option value="">None</option>
                  {editDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Year</Label>
                  <Input value={eYear} onChange={(e) => setEYear(e.target.value)} />
                </div>
                <div>
                  <Label>Section</Label>
                  <Input value={eSection} onChange={(e) => setESection(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>New password (optional)</Label>
                <Input type="password" value={ePassword} onChange={(e) => setEPassword(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-app-label">
                <input type="checkbox" checked={eActive} onChange={(e) => setEActive(e.target.checked)} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-app-label">
                <input type="checkbox" checked={eForceChange} onChange={(e) => setEForceChange(e.target.checked)} />
                Force password change
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <Button onClick={() => saveEditMut.mutate()} disabled={saveEditMut.isPending}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
