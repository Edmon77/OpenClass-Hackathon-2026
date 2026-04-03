import { NotificationType, BookingStatus } from '@prisma/client';
import { prisma } from './prisma.js';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export const CUTOFF_MINUTES_DEFAULT = envInt('CUTOFF_MINUTES', 10);

/** Hours before class start for advance reminder notification (0 = off). */
export const ADVANCE_REMINDER_HOURS = envInt('ADVANCE_REMINDER_HOURS', 24);

const TZ = 'Africa/Addis_Ababa';

function fmtLocal(d: Date): string {
  return d.toLocaleString('en-GB', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function createNotificationsForBooking(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, status: BookingStatus.booked },
    include: {
      course: true,
      room: { include: { building: true } },
    },
  });
  if (!booking) return;

  const roomLabel = `${booking.room.building.name} ${booking.room.roomNumber}`;
  const courseName = booking.course.courseName;

  const students = await prisma.user.findMany({
    where: {
      role: 'student',
      isActive: true,
      department: booking.course.department,
      year: booking.course.year,
      classSection: booking.course.classSection,
    },
    select: { id: true },
  });

  const targetIds = new Set<string>([booking.course.teacherUserId, ...students.map((s) => s.id)]);
  const now = new Date();
  const start = booking.startTime;
  const cutoff = new Date(start);
  cutoff.setMinutes(cutoff.getMinutes() - CUTOFF_MINUTES_DEFAULT);
  const advanceAt =
    ADVANCE_REMINDER_HOURS > 0
      ? new Date(start.getTime() - ADVANCE_REMINDER_HOURS * 60 * 60 * 1000)
      : null;

  const rows: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    scheduledTime: Date | null;
    bookingId: string;
  }[] = [];

  for (const userId of targetIds) {
    if (advanceAt && advanceAt > now) {
      rows.push({
        userId,
        type: NotificationType.advance,
        title: 'Upcoming class',
        message: `${courseName} · ${roomLabel} · starts ${fmtLocal(start)}.`,
        scheduledTime: advanceAt,
        bookingId: booking.id,
      });
    }
    if (cutoff > now) {
      rows.push({
        userId,
        type: NotificationType.cutoff_warning,
        title: 'Room needed soon',
        message: `${roomLabel} will be used for ${courseName} in ${CUTOFF_MINUTES_DEFAULT} minutes. Please prepare to leave.`,
        scheduledTime: cutoff,
        bookingId: booking.id,
      });
    }
    rows.push({
      userId,
      type: NotificationType.class_start,
      title: 'Class starting',
      message: `${courseName} starts ${fmtLocal(start)} · ${roomLabel}.`,
      scheduledTime: start,
      bookingId: booking.id,
    });
  }

  if (rows.length) {
    await prisma.notification.createMany({
      data: rows,
    });
  }
}

export async function onBookingCancelled(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId },
    include: {
      course: true,
      room: { include: { building: true } },
    },
  });
  if (!booking) return;

  await prisma.notification.deleteMany({
    where: {
      bookingId,
      type: { in: [NotificationType.class_start, NotificationType.cutoff_warning, NotificationType.advance] },
    },
  });

  const roomLabel = `${booking.room.building.name} ${booking.room.roomNumber}`;
  const students = await prisma.user.findMany({
    where: {
      role: 'student',
      isActive: true,
      department: booking.course.department,
      year: booking.course.year,
      classSection: booking.course.classSection,
    },
    select: { id: true },
  });
  const targetIds = new Set<string>([booking.course.teacherUserId, ...students.map((s) => s.id)]);

  await prisma.notification.createMany({
    data: [...targetIds].map((userId) => ({
      userId,
      type: NotificationType.cancelled,
      title: 'Booking cancelled',
      message: `${booking.course.courseName} in ${roomLabel} was cancelled.`,
      scheduledTime: new Date(),
      bookingId: booking.id,
    })),
  });
}
