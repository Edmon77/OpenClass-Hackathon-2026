import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button, Card, Input, Label, PageHeader, Toolbar } from '@/components/ui';

type CatRow = { id: string; course_name: string; course_code: string | null; is_active: boolean };

export function CatalogPage() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ['admin', 'catalog'],
    queryFn: async () => {
      const d = await apiFetch<{ courses: CatRow[] }>('/admin/catalog/courses');
      return d.courses;
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editRow, setEditRow] = useState<CatRow | null>(null);
  const [eName, setEName] = useState('');
  const [eCode, setECode] = useState('');

  const createMut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Course name required');
      await apiFetch('/admin/catalog/courses', {
        method: 'POST',
        json: { courseName: name.trim(), courseCode: code.trim() || undefined },
      });
    },
    onSuccess: () => {
      toast.success('Catalog entry added');
      setName('');
      setCode('');
      setShowCreate(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'catalog'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const saveEditMut = useMutation({
    mutationFn: async () => {
      if (!editRow) return;
      await apiFetch(`/admin/catalog/courses/${editRow.id}`, {
        method: 'PUT',
        json: { courseName: eName.trim() || undefined, courseCode: eCode.trim() || null },
      });
    },
    onSuccess: () => {
      toast.success('Updated');
      setEditRow(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'catalog'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/admin/catalog/courses/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast.success('Deactivated');
      void qc.invalidateQueries({ queryKey: ['admin', 'catalog'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div>
      <PageHeader
        title="Course catalog"
        subtitle="Master course list (name + code). Offerings link these to departments per year."
      />

      <Toolbar>
        <Button variant="secondary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Close' : 'New catalog course'}
        </Button>
      </Toolbar>

      {showCreate && (
        <Card className="mb-6 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Course name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Code (optional)</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          </div>
          <Button className="mt-3" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            Create
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-app-separator px-4 py-3 text-sm font-medium">Catalog ({rows.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-app-separator text-xs text-app-subtle">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-app-separator/80">
                  <td className="px-4 py-3 font-medium text-app-label">{r.course_name}</td>
                  <td className="px-4 py-3 text-app-muted">{r.course_code ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-app-subtle">{r.id}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => {
                      setEditRow(r);
                      setEName(r.course_name);
                      setECode(r.course_code ?? '');
                    }}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs text-app-destructive"
                      onClick={() => {
                        if (confirm('Deactivate this catalog entry?')) deleteMut.mutate(r.id);
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
        {rows.length === 0 && <p className="p-6 text-sm text-app-subtle">Empty catalog.</p>}
      </Card>

      {editRow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app-overlay p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="font-semibold text-app-label">Edit catalog</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={eName} onChange={(e) => setEName(e.target.value)} />
              </div>
              <div>
                <Label>Code</Label>
                <Input value={eCode} onChange={(e) => setECode(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => saveEditMut.mutate()} disabled={saveEditMut.isPending}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setEditRow(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
