import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Badge, Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { useState } from 'react';

type SemesterRow = { id: string; name: string; start_date: string; end_date: string; is_active: boolean };

export function SemestersPage() {
  const qc = useQueryClient();
  const { data: semesters = [] } = useQuery({
    queryKey: ['admin', 'semesters'],
    queryFn: async () => {
      const s = await apiFetch<{ semesters: SemesterRow[] }>('/admin/semesters');
      return s.semesters;
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [semName, setSemName] = useState('');
  const [semStart, setSemStart] = useState('2026-01-01');
  const [semEnd, setSemEnd] = useState('2026-06-30');

  const createMut = useMutation({
    mutationFn: async () => {
      if (!semName.trim()) throw new Error('Name required');
      await apiFetch('/admin/semesters', {
        method: 'POST',
        json: { name: semName.trim(), startDate: semStart.trim(), endDate: semEnd.trim() },
      });
    },
    onSuccess: () => {
      toast.success('Academic year created');
      setSemName('');
      void qc.invalidateQueries({ queryKey: ['admin', 'semesters'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const activateMut = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/admin/semesters/${id}/activate`, { method: 'POST' });
    },
    onSuccess: () => {
      toast.success('Active year updated');
      void qc.invalidateQueries({ queryKey: ['admin', 'semesters'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const closeMut = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/admin/semesters/${id}/close`, { method: 'POST' });
    },
    onSuccess: () => {
      toast.success('Year closed');
      void qc.invalidateQueries({ queryKey: ['admin', 'semesters'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div>
      <PageHeader
        title="Academic years"
        subtitle="Create years, set one as active, and close old years when archiving."
      />

      <Button variant="secondary" className="mb-4" onClick={() => setShowForm(!showForm)}>
        {showForm ? 'Close' : 'New academic year'}
      </Button>

      {showForm && (
        <Card className="mb-6 p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-3">
              <Label>Name</Label>
              <Input value={semName} onChange={(e) => setSemName(e.target.value)} placeholder="2025/26" />
            </div>
            <div>
              <Label>Start (YYYY-MM-DD)</Label>
              <Input value={semStart} onChange={(e) => setSemStart(e.target.value)} />
            </div>
            <div>
              <Label>End (YYYY-MM-DD)</Label>
              <Input value={semEnd} onChange={(e) => setSemEnd(e.target.value)} />
            </div>
          </div>
          <Button className="mt-3" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            Create
          </Button>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {semesters.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-app-label">{s.name}</h3>
                  {s.is_active && <Badge tone="success">Active</Badge>}
                </div>
                <p className="mt-1 text-sm text-app-muted">
                  {s.start_date} → {s.end_date}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" className="text-xs" onClick={() => activateMut.mutate(s.id)}>
                Set active
              </Button>
              <Button
                variant="danger"
                className="text-xs"
                onClick={() => {
                  if (confirm('Close this academic year? Offerings and CR assignments may be affected.')) {
                    closeMut.mutate(s.id);
                  }
                }}
              >
                Close & archive
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {semesters.length === 0 && <p className="mt-4 text-sm text-app-subtle">No academic years yet.</p>}
    </div>
  );
}
