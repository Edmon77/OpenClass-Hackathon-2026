import type { FastifyPluginAsync } from 'fastify';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getRoomUiState } from '../lib/roomLifecycle.js';

export const buildingsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    { preHandler: [app.authenticate] },
    async () => {
      const rows = await prisma.building.findMany({
        where: { isActive: true },
        include: {
          _count: { select: { rooms: { where: { isActive: true } } } },
          rooms: {
            where: { isActive: true },
            select: { id: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      const now = new Date();

      const out = await Promise.all(
        rows.map(async (b) => {
          const roomIds = b.rooms.map((r) => r.id);
          let green = 0;
          let yellow = 0;
          let red = 0;
          if (roomIds.length) {
            const bookings = await prisma.booking.findMany({
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
            for (const rid of roomIds) {
              const ui = getRoomUiState(now, byRoom.get(rid) ?? []);
              if (ui === 'green') green++;
              else if (ui === 'yellow') yellow++;
              else red++;
            }
          }

          return {
            id: b.id,
            building_name: b.name,
            floor_count: b.floorCount,
            room_count: b._count.rooms,
            status_summary: { green, yellow, red },
          };
        })
      );

      return { buildings: out };
    }
  );
};
