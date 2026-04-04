import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Card, Input, Label, PageHeader, Toolbar } from '@/components/ui';

type RoomRow = { id: string; room_number: string; floor_index: number; capacity: number };
type BookingRow = { start_time: string; end_time: string; status: string };

type BuildingPayload = {
  building: { id: string; building_name: string; floor_count: number };
  rooms: RoomRow[];
  bookings_by_room: Record<string, BookingRow[]>;
};

export function CampusBuildingPage() {
  const { id } = useParams<{ id: string }>();
  const [floor, setFloor] = useState(0);
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: ['building', id],
    enabled: !!id,
    queryFn: async () => apiFetch<BuildingPayload>(`/rooms/building/${id!}`),
  });

  const roomsOnFloor = useMemo(() => {
    if (!data) return [];
    return data.rooms.filter((r) => r.floor_index === floor);
  }, [data, floor]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roomsOnFloor;
    return roomsOnFloor.filter((r) => r.room_number.toLowerCase().includes(q));
  }, [roomsOnFloor, search]);

  if (!id) return <p className="text-app-subtle">Missing building id.</p>;
  if (!data) return <p className="text-app-subtle">Loading…</p>;

  const floors = Array.from({ length: data.building.floor_count }, (_, i) => i);

  return (
    <div>
      <PageHeader title={data.building.building_name} subtitle="Rooms on each floor — open a room to book or view schedule." />
      <Toolbar className="items-center">
        {floors.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFloor(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              floor === f ? 'bg-app-campus text-white shadow-sm' : 'bg-app-fill text-app-label hover:bg-app-secondary'
            }`}
          >
            {f === 0 ? 'Ground' : `Floor ${f}`}
          </button>
        ))}
      </Toolbar>
      <Card className="mb-4 p-4">
        <Label className="!mb-2">Filter room number</Label>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. 201" />
      </Card>
      <ul className="space-y-2">
        {filtered.map((r) => (
          <li key={r.id}>
            <Link to={`/campus/room/${r.id}`}>
              <Card className="p-4 transition hover:border-app-accent/40">
                <span className="font-medium text-app-label">Room {r.room_number}</span>
                <span className="ml-2 text-sm text-app-subtle">capacity {r.capacity}</span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && <p className="text-sm text-app-subtle">No rooms on this floor.</p>}
    </div>
  );
}
