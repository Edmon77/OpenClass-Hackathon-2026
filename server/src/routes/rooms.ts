import type { FastifyPluginAsync } from 'fastify';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getRoomUiState } from '../lib/roomLifecycle.js';

export const roomsRoutes: FastifyPluginAsync = async (app) => {
  /** Campus-wide room ID search (must be registered before /:roomId). */
  app.get(
    '/search',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const q = String((request.query as { q?: string }).q ?? '').trim();
      if (q.length < 1) return reply.status(400).send({ error: 'Missing query q' });
      if (q.length > 64) return reply.status(400).send({ error: 'Query too long' });

      const rooms = await prisma.room.findMany({
        where: {
          isActive: true,
          roomNumber: { contains: q, mode: 'insensitive' },
        },
        include: { building: true },
        take: 50,
        orderBy: [{ building: { name: 'asc' } }, { floorIndex: 'asc' }, { roomNumber: 'asc' }],
      });

      const roomIds = rooms.map((r) => r.id);
      const bookings =
        roomIds.length === 0
          ? []
          : await prisma.booking.findMany({
              where: { roomId: { in: roomIds }, status: BookingStatus.booked },
              select: { roomId: true, startTime: true, endTime: true, status: true },
            });

      const byRoom = new Map<string, { start_time: Date; end_time: Date; status: BookingStatus }[]>();
      for (const bk of bookings) {
        const list = byRoom.get(bk.roomId) ?? [];
        list.push({
          start_time: bk.startTime,
          end_time: bk.endTime,
          status: bk.status,
        });
        byRoom.set(bk.roomId, list);
      }

      const now = new Date();

      return {
        rooms: rooms.map((r) => ({
          id: r.id,
          room_number: r.roomNumber,
          floor_index: r.floorIndex,
          building_id: r.buildingId,
          building_name: r.building.name,
          status: getRoomUiState(now, byRoom.get(r.id) ?? []),
        })),
      };
    }
  );

  app.get(
    '/building/:buildingId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { buildingId } = request.params as { buildingId: string };
      const building = await prisma.building.findFirst({
        where: { id: buildingId, isActive: true },
      });
      if (!building) return reply.status(404).send({ error: 'Building not found' });

      const rooms = await prisma.room.findMany({
        where: { buildingId, isActive: true },
        orderBy: [{ floorIndex: 'asc' }, { roomNumber: 'asc' }],
      });

      const bookingsByRoom: Record<string, unknown[]> = {};
      for (const r of rooms) {
        const bs = await prisma.booking.findMany({
          where: { roomId: r.id },
          orderBy: { startTime: 'asc' },
          include: { course: { select: { courseName: true } } },
        });
        bookingsByRoom[r.id] = bs.map((b) => ({
          id: b.id,
          start_time: b.startTime.toISOString(),
          end_time: b.endTime.toISOString(),
          status: b.status,
          course_id: b.courseId,
          course_name: b.course.courseName,
        }));
      }

      return {
        building: {
          id: building.id,
          building_name: building.name,
          floor_count: building.floorCount,
        },
        rooms: rooms.map((r) => ({
          id: r.id,
          room_number: r.roomNumber,
          floor_index: r.floorIndex,
          capacity: r.capacity,
          equipment_json: r.equipmentJson,
          building_name: building.name,
        })),
        bookings_by_room: bookingsByRoom,
      };
    }
  );

  app.get(
    '/:roomId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { roomId } = request.params as { roomId: string };
      const row = await prisma.room.findFirst({
        where: { id: roomId, isActive: true },
        include: { building: true },
      });
      if (!row) return reply.status(404).send({ error: 'Room not found' });

      const bookings = await prisma.booking.findMany({
        where: { roomId },
        orderBy: { startTime: 'asc' },
        include: { course: { select: { courseName: true, id: true } } },
      });

      return {
        room: {
          id: row.id,
          room_number: row.roomNumber,
          floor_index: row.floorIndex,
          capacity: row.capacity,
          equipment_json: row.equipmentJson,
          building_name: row.building.name,
        },
        bookings: bookings.map((b) => ({
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
};
