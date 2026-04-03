/** Room Green/Yellow/Red — aligned with mobile `domain/roomState`. */
import { BookingStatus } from '@prisma/client';

export type RoomUiState = 'green' | 'yellow' | 'red';

export type BookingLike = {
  start_time: Date;
  end_time: Date;
  status: BookingStatus;
};

export function getRoomUiState(now: Date, bookings: BookingLike[]): RoomUiState {
  const active = bookings.filter((b) => b.status === BookingStatus.booked);
  const inProgress = active.find((b) => b.start_time <= now && now < b.end_time);
  if (inProgress) return 'red';

  const future = active
    .filter((b) => b.start_time > now)
    .sort((a, b) => a.start_time.getTime() - b.start_time.getTime());
  if (future.length) return 'yellow';
  return 'green';
}
