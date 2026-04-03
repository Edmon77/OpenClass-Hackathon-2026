export type RoomUiState = 'green' | 'yellow' | 'red';

export type BookingRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
};

const CUTOFF_MINUTES_DEFAULT = 10;

export function getRoomUiState(now: Date, bookings: BookingRow[]): RoomUiState {
  const active = bookings.filter((b) => b.status === 'booked');
  const inProgress = active.find((b) => {
    const s = new Date(b.start_time);
    const e = new Date(b.end_time);
    return s <= now && now < e;
  });
  if (inProgress) return 'red';

  const future = active
    .filter((b) => new Date(b.start_time) > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  if (future.length) return 'yellow';
  return 'green';
}

export function getNextBooking(bookings: BookingRow[]): BookingRow | null {
  const now = new Date();
  const active = bookings.filter((b) => b.status === 'booked');
  const future = active
    .filter((b) => new Date(b.start_time) > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  return future[0] ?? null;
}

export function getCurrentBooking(bookings: BookingRow[]): BookingRow | null {
  const now = new Date();
  const active = bookings.filter((b) => b.status === 'booked');
  return (
    active.find((b) => {
      const s = new Date(b.start_time);
      const e = new Date(b.end_time);
      return s <= now && now < e;
    }) ?? null
  );
}

export function getTemporaryUseCutoffIso(bookingStartIso: string, cutoffMinutes = CUTOFF_MINUTES_DEFAULT): string {
  const start = new Date(bookingStartIso);
  start.setMinutes(start.getMinutes() - cutoffMinutes);
  return start.toISOString();
}

export { CUTOFF_MINUTES_DEFAULT };
