import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { Button, Card, Input, Label, PageHeader, Toolbar } from '@/components/ui';

type BuildingRow = {
  id: string;
  building_name: string;
  floor_count: number;
  room_count: number;
  status_summary?: { green: number; yellow: number; red: number };
};

type Hit = { id: string; room_number: string; building_name: string; floor_index: number; capacity: number };

export function CampusPage() {
  const [search, setSearch] = useState('');
  const [roomQ, setRoomQ] = useState('');

  const { data: buildings = [], refetch } = useQuery({
    queryKey: ['buildings'],
    queryFn: async () => {
      const data = await apiFetch<{ buildings: BuildingRow[] }>('/buildings');
      return data.buildings;
    },
  });

  const { data: hits = [], isFetching: searching } = useQuery({
    queryKey: ['rooms', 'search', roomQ],
    enabled: roomQ.trim().length >= 1,
    queryFn: async () => {
      const data = await apiFetch<{ rooms: Hit[] }>(`/rooms/search?q=${encodeURIComponent(roomQ.trim())}`);
      return data.rooms;
    },
  });

  const filtered = search.trim()
    ? buildings.filter((b) => b.building_name.toLowerCase().includes(search.trim().toLowerCase()))
    : buildings;

  return (
    <div>
      <PageHeader
        title="Campus"
        subtitle="Buildings and room search — same APIs as the mobile Explore tab."
      />
      <Toolbar>
        <Button variant="secondary" onClick={() => refetch()}>
          Refresh buildings
        </Button>
      </Toolbar>

      <Card className="mb-6 p-4 sm:p-5">
        <Label className="!mb-2">Filter buildings</Label>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Building name…" />
      </Card>

      <Card className="mb-8 p-4 sm:p-5">
        <Label className="!mb-2">Search rooms</Label>
        <Input value={roomQ} onChange={(e) => setRoomQ(e.target.value)} placeholder="Room number or keyword…" />
        {searching && <p className="mt-2 text-xs text-app-subtle">Searching…</p>}
        <ul className="mt-3 space-y-2">
          {hits.map((h) => (
            <li key={h.id}>
              <Link
                to={`/campus/room/${h.id}`}
                className="block rounded-lg border border-app-separator px-3 py-2 text-sm hover:border-app-accent/40"
              >
                <span className="font-medium text-app-label">
                  {h.building_name} · {h.room_number}
                </span>
                <span className="ml-2 text-app-subtle">
                  floor {h.floor_index} · cap {h.capacity}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => (
          <Link key={b.id} to={`/campus/building/${b.id}`}>
            <Card className="h-full p-4 transition hover:border-app-accent/40">
              <div className="font-semibold text-app-label">{b.building_name}</div>
              <div className="mt-1 text-xs text-app-subtle">
                {b.floor_count} floors · {b.room_count} rooms
                {b.status_summary ? (
                  <span className="ml-2">
                    ●{b.status_summary.green} ◐{b.status_summary.yellow} ●{b.status_summary.red}
                  </span>
                ) : null}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
