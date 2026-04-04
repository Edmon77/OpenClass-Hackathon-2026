import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button, Card, Input, Label, PageHeader, Select } from '@/components/ui';

type BuildingRow = { id: string; building_name: string; floor_count: number; room_count: number };

const ROOM_TYPES = ['lecture_hall', 'lab', 'office', 'seminar', 'other'] as const;

export function BuildingsRoomsPage() {
  const qc = useQueryClient();
  const { data: buildings = [], refetch } = useQuery({
    queryKey: ['buildings'],
    queryFn: async () => {
      const b = await apiFetch<{ buildings: BuildingRow[] }>('/buildings');
      return b.buildings;
    },
  });

  const [bName, setBName] = useState('');
  const [bFloors, setBFloors] = useState('3');
  const [roomBuildingId, setRoomBuildingId] = useState<string | null>(null);
  const [roomNum, setRoomNum] = useState('');
  const [roomFloor, setRoomFloor] = useState('0');
  const [roomCap, setRoomCap] = useState('30');
  const [roomType, setRoomType] = useState<(typeof ROOM_TYPES)[number]>('lecture_hall');
  const [hasProjector, setHasProjector] = useState(false);
  const [hasInternet, setHasInternet] = useState(false);
  const [hasPower, setHasPower] = useState(true);

  const buildingId = roomBuildingId ?? buildings[0]?.id ?? null;

  const createBuilding = useMutation({
    mutationFn: async () => {
      const n = parseInt(bFloors, 10);
      if (!bName.trim() || !Number.isFinite(n) || n < 1) throw new Error('Name and floor count (≥1) required');
      await apiFetch('/admin/buildings', { method: 'POST', json: { name: bName.trim(), floorCount: n } });
    },
    onSuccess: () => {
      toast.success('Building added');
      setBName('');
      void qc.invalidateQueries({ queryKey: ['buildings'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const createRoom = useMutation({
    mutationFn: async () => {
      if (!buildingId) throw new Error('Select a building');
      const fi = parseInt(roomFloor, 10);
      const cap = parseInt(roomCap, 10);
      if (!roomNum.trim() || !Number.isFinite(fi) || fi < 0 || !Number.isFinite(cap) || cap < 1) {
        throw new Error('Room number, floor index, and capacity required');
      }
      await apiFetch('/admin/rooms', {
        method: 'POST',
        json: {
          buildingId,
          roomNumber: roomNum.trim(),
          floorIndex: fi,
          capacity: cap,
          roomType,
          hasProjector,
          hasInternet,
          hasPower,
        },
      });
    },
    onSuccess: () => {
      toast.success('Room added');
      setRoomNum('');
      void qc.invalidateQueries({ queryKey: ['buildings'] });
      void refetch();
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div>
      <PageHeader
        title="Buildings & rooms"
        subtitle="Create buildings, then add rooms with capacity and equipment flags."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-app-label">New building</h2>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={bName} onChange={(e) => setBName(e.target.value)} placeholder="Building A" />
            </div>
            <div>
              <Label>Floor count</Label>
              <Input value={bFloors} onChange={(e) => setBFloors(e.target.value)} type="number" min={1} />
            </div>
            <Button onClick={() => createBuilding.mutate()} disabled={createBuilding.isPending}>
              Create building
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-app-label">New room</h2>
          <div className="space-y-3">
            <div>
              <Label>Building</Label>
              <Select
                value={buildingId ?? ''}
                onChange={(e) => setRoomBuildingId(e.target.value || null)}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.building_name} ({b.room_count} rooms)
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Room number</Label>
              <Input value={roomNum} onChange={(e) => setRoomNum(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Floor index</Label>
                <Input value={roomFloor} onChange={(e) => setRoomFloor(e.target.value)} type="number" min={0} />
              </div>
              <div>
                <Label>Capacity</Label>
                <Input value={roomCap} onChange={(e) => setRoomCap(e.target.value)} type="number" min={1} />
              </div>
            </div>
            <div>
              <Label>Room type</Label>
              <Select value={roomType} onChange={(e) => setRoomType(e.target.value as (typeof ROOM_TYPES)[number])}>
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-app-label">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hasProjector} onChange={(e) => setHasProjector(e.target.checked)} />
                Projector
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hasInternet} onChange={(e) => setHasInternet(e.target.checked)} />
                Internet
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hasPower} onChange={(e) => setHasPower(e.target.checked)} />
                Power
              </label>
            </div>
            <Button onClick={() => createRoom.mutate()} disabled={createRoom.isPending || !buildings.length}>
              Create room
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-8 overflow-hidden">
        <div className="border-b border-app-separator px-4 py-3 text-sm font-medium">Buildings</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-app-separator text-xs text-app-subtle">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Floors</th>
                <th className="px-4 py-2">Rooms</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((b) => (
                <tr key={b.id} className="border-b border-app-separator/80">
                  <td className="px-4 py-3 text-app-label">{b.building_name}</td>
                  <td className="px-4 py-3 text-app-muted">{b.floor_count}</td>
                  <td className="px-4 py-3 text-app-muted">{b.room_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {buildings.length === 0 && <p className="p-6 text-sm text-app-subtle">No buildings yet.</p>}
      </Card>
    </div>
  );
}
