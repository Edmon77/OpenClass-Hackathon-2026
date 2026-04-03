import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { bookingsOverlap } from '../domain/bookingConflict';

export class BookingConflictError extends Error {
  code = 'ROOM_SLOT_CONFLICT' as const;
}

export async function assertNoOverlap(
  db: SQLiteDatabase,
  roomId: string,
  startIso: string,
  endIso: string,
  excludeBookingId?: string
): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; start_time: string; end_time: string; status: string }>(
    `SELECT id, start_time, end_time, status FROM bookings WHERE room_id = ? AND status = 'booked'`,
    [roomId]
  );
  const interval = { start: startIso, end: endIso };
  for (const r of rows) {
    if (excludeBookingId && r.id === excludeBookingId) continue;
    if (bookingsOverlap(interval, { start: r.start_time, end: r.end_time })) {
      throw new BookingConflictError('That time overlaps another booking.');
    }
  }
}

export async function createBooking(
  db: SQLiteDatabase,
  params: {
    roomId: string;
    courseId: string;
    teacherUserId: string | null;
    crUserId: string | null;
    department: string;
    year: number;
    classSection: string;
    startIso: string;
    endIso: string;
  }
): Promise<string> {
  await assertNoOverlap(db, params.roomId, params.startIso, params.endIso);
  const id = await Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO bookings (id, room_id, course_id, teacher_user_id, cr_user_id, department, year, class_section, start_time, end_time, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked', ?, ?)`,
    [
      id,
      params.roomId,
      params.courseId,
      params.teacherUserId,
      params.crUserId,
      params.department,
      params.year,
      params.classSection,
      params.startIso,
      params.endIso,
      now,
      now,
    ]
  );
  return id;
}

export async function cancelBooking(db: SQLiteDatabase, bookingId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(`UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?`, [
    now,
    bookingId,
  ]);
}
