import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { BookingStatus, EventType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError, ROOM_SLOT_CONFLICT } from '../lib/errors.js';
import { createNotificationsForBooking, onBookingCancelled } from '../lib/bookingNotifications.js';

const EVENT_TYPES = ['lecture', 'exam', 'tutor', 'defense', 'lab', 'presentation'] as const;
const TEACHER_EVENT_TYPES: readonly string[] = ['lecture', 'tutor', 'exam', 'lab', 'presentation'];
const CR_EVENT_TYPES: readonly string[] = ['lecture', 'presentation', 'lab'];

const createBody = z.object({
  roomId: z.string().uuid(),
  courseId: z.string().uuid(),
  // ISO strings from JS include ms (e.g. .000Z); zod datetime() rejects them without precision
  startTime: z.string().datetime({ precision: 3 }),
  endTime: z.string().datetime({ precision: 3 }),
  eventType: z.enum(EVENT_TYPES).optional(),
  nextBookingPreference: z.boolean().optional(),
});

async function assertNoOverlap(roomId: string, start: Date, end: Date, excludeId?: string) {
  const clash = await prisma.booking.findFirst({
    where: {
      roomId,
      status: BookingStatus.booked,
      id: excludeId ? { not: excludeId } : undefined,
      AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
    },
  });
  if (clash) {
    const err = new AppError(409, 'Time slot overlaps an existing booking', ROOM_SLOT_CONFLICT);
    throw err;
  }
}

export const bookingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/mine', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const role = (request.user as { role: string }).role;

    const where: {
      status: typeof BookingStatus.booked;
      teacherUserId?: string;
      crUserId?: string;
    } = { status: BookingStatus.booked };

    if (role === 'admin') {
      // no scope filter
    } else if (role === 'teacher') {
      where.teacherUserId = userId;
    } else if (role === 'student') {
      where.crUserId = userId;
    } else {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const list = await prisma.booking.findMany({
      where: role === 'admin' ? { status: BookingStatus.booked } : where,
      orderBy: { startTime: 'asc' },
      include: {
        course: { select: { courseName: true } },
        room: { include: { building: { select: { name: true } } } },
      },
      take: 200,
    });

    return {
      bookings: list.map((b) => ({
        id: b.id,
        room_id: b.roomId,
        room_number: b.room.roomNumber,
        building_name: b.room.building.name,
        course_id: b.courseId,
        course_name: b.course.courseName,
        event_type: b.eventType,
        start_time: b.startTime.toISOString(),
        end_time: b.endTime.toISOString(),
        status: b.status,
        next_booking_preference: b.nextBookingPreference,
      })),
    };
  });

  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const userId = (request.user as { sub: string }).sub;
    const role = (request.user as { role: string }).role;

    const start = new Date(parsed.data.startTime);
    const end = new Date(parsed.data.endTime);
    if (end <= start) return reply.status(400).send({ error: 'endTime must be after startTime' });

    const course = await prisma.course.findFirst({
      where: { id: parsed.data.courseId, isActive: true },
      include: { semester: true },
    });
    if (!course) return reply.status(404).send({ error: 'Course not found' });

    const eventType = (parsed.data.eventType ?? 'lecture') as EventType;

    if (role === 'teacher') {
      if (course.teacherUserId !== userId) {
        return reply.status(403).send({ error: 'Not your course' });
      }
      if (!TEACHER_EVENT_TYPES.includes(eventType)) {
        return reply.status(403).send({ error: `Teachers cannot create "${eventType}" events. Allowed: ${TEACHER_EVENT_TYPES.join(', ')}` });
      }
    } else if (role === 'student') {
      const cr = await prisma.crAssignment.findFirst({
        where: {
          userId,
          semesterId: course.semesterId,
          isActive: true,
          department: course.department,
          year: course.year,
          classSection: course.classSection,
        },
      });
      if (!cr) return reply.status(403).send({ error: 'CR scope required' });
      if (!CR_EVENT_TYPES.includes(eventType)) {
        return reply.status(403).send({ error: `CRs cannot create "${eventType}" events. Allowed: ${CR_EVENT_TYPES.join(', ')}` });
      }
    } else if (role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    try {
      await assertNoOverlap(parsed.data.roomId, start, end);
    } catch (e) {
      if (e instanceof AppError) {
        return reply.status(e.statusCode).send({ error: e.message, code: e.code });
      }
      throw e;
    }

    const booking = await prisma.booking.create({
      data: {
        roomId: parsed.data.roomId,
        courseId: parsed.data.courseId,
        teacherUserId: course.teacherUserId,
        crUserId: role === 'student' ? userId : null,
        department: course.department,
        year: course.year,
        classSection: course.classSection,
        eventType,
        startTime: start,
        endTime: end,
        status: BookingStatus.booked,
        nextBookingPreference: parsed.data.nextBookingPreference ?? false,
      },
    });

    await createNotificationsForBooking(booking.id).catch(() => {});

    return {
      booking: {
        id: booking.id,
        room_id: booking.roomId,
        event_type: booking.eventType,
        start_time: booking.startTime.toISOString(),
        end_time: booking.endTime.toISOString(),
        status: booking.status,
        next_booking_preference: booking.nextBookingPreference,
      },
    };
  });

  app.get(
    '/room/:roomId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { roomId } = request.params as { roomId: string };
      const list = await prisma.booking.findMany({
        where: { roomId },
        orderBy: { startTime: 'asc' },
        include: { course: { select: { courseName: true } } },
      });
      return {
        bookings: list.map((b) => ({
          id: b.id,
          start_time: b.startTime.toISOString(),
          end_time: b.endTime.toISOString(),
          status: b.status,
          event_type: b.eventType,
          course_id: b.courseId,
          course_name: b.course.courseName,
        })),
      };
    }
  );

  app.get(
    '/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const b = await prisma.booking.findUnique({
        where: { id },
        include: { course: true },
      });
      if (!b) return reply.status(404).send({ error: 'Not found' });
      return {
        booking: {
          id: b.id,
          room_id: b.roomId,
          course_id: b.courseId,
          event_type: b.eventType,
          start_time: b.startTime.toISOString(),
          end_time: b.endTime.toISOString(),
          status: b.status,
          course_name: b.course.courseName,
        },
      };
    }
  );

  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;
    const role = (request.user as { role: string }).role;

    const b = await prisma.booking.findUnique({
      where: { id },
      include: { course: true },
    });
    if (!b) return reply.status(404).send({ error: 'Not found' });
    if (b.status !== BookingStatus.booked) return reply.status(400).send({ error: 'Already cancelled' });

    if (role === 'admin') {
      await prisma.booking.update({ where: { id }, data: { status: BookingStatus.cancelled } });
      await onBookingCancelled(id).catch(() => {});
      return { ok: true };
    }
    if (role === 'teacher' && b.course.teacherUserId === userId) {
      await prisma.booking.update({ where: { id }, data: { status: BookingStatus.cancelled } });
      await onBookingCancelled(id).catch(() => {});
      return { ok: true };
    }
    if (role === 'student') {
      const cr = await prisma.crAssignment.findFirst({
        where: {
          userId,
          semesterId: b.course.semesterId,
          isActive: true,
          department: b.course.department,
          year: b.course.year,
          classSection: b.course.classSection,
        },
      });
      if (cr) {
        await prisma.booking.update({ where: { id }, data: { status: BookingStatus.cancelled } });
        await onBookingCancelled(id).catch(() => {});
        return { ok: true };
      }
    }
    return reply.status(403).send({ error: 'Forbidden' });
  });
};
