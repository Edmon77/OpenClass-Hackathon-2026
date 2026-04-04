import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AlertSubscriptionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { replyInvalidBody } from '../lib/zodHttp.js';
import { prismaStringId } from '../lib/zodPrisma.js';

const subscribeBody = z.preprocess(
  (val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const o = val as Record<string, unknown>;
      const rid = o.roomId ?? o.room_id;
      let nbm = o.notifyBeforeMinutes ?? o.notify_before_minutes;
      // JSON.stringify(NaN) → null, which breaks z.coerce.number()
      if (nbm === null || nbm === undefined || nbm === '') nbm = undefined;
      return {
        roomId: Array.isArray(rid) ? rid[0] : rid,
        notifyBeforeMinutes: nbm,
      };
    }
    return val;
  },
  z.object({
    roomId: prismaStringId,
    notifyBeforeMinutes: z.coerce.number().int().min(1).max(120).optional(),
  })
);

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const roomAlertsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = (request.user as { sub: string }).sub;
    const now = new Date();
    await prisma.roomAlertSubscription.updateMany({
      where: {
        status: AlertSubscriptionStatus.active,
        expiresAt: { lte: now },
      },
      data: { status: AlertSubscriptionStatus.expired },
    });
    const rows = await prisma.roomAlertSubscription.findMany({
      where: {
        userId,
        status: AlertSubscriptionStatus.active,
        expiresAt: { gt: now },
      },
      include: { room: { include: { building: true } } },
    });
    return {
      subscriptions: rows.map((s) => ({
        id: s.id,
        room_id: s.roomId,
        room_number: s.room.roomNumber,
        building_name: s.room.building.name,
        notify_before_minutes: s.notifyBeforeMinutes,
        expires_at: s.expiresAt.toISOString(),
        status: s.status,
      })),
    };
  });

  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = subscribeBody.safeParse(request.body);
    if (!parsed.success) return replyInvalidBody(reply, parsed.error);
    const userId = (request.user as { sub: string }).sub;
    const now = new Date();
    await prisma.roomAlertSubscription.updateMany({
      where: {
        status: AlertSubscriptionStatus.active,
        expiresAt: { lte: now },
      },
      data: { status: AlertSubscriptionStatus.expired },
    });
    const room = await prisma.room.findFirst({
      where: { id: parsed.data.roomId, isActive: true },
    });
    if (!room) return reply.status(404).send({ error: 'Room not found' });

    const expiresAt = new Date(Date.now() + TWO_HOURS_MS);
    const notifyBefore = parsed.data.notifyBeforeMinutes ?? 10;

    await prisma.roomAlertSubscription.updateMany({
      where: {
        userId,
        roomId: room.id,
        status: AlertSubscriptionStatus.active,
      },
      data: { status: AlertSubscriptionStatus.cancelled },
    });

    const sub = await prisma.roomAlertSubscription.create({
      data: {
        userId,
        roomId: room.id,
        notifyBeforeMinutes: notifyBefore,
        expiresAt,
        status: AlertSubscriptionStatus.active,
      },
    });

    return {
      subscription: {
        id: sub.id,
        room_id: sub.roomId,
        expires_at: sub.expiresAt.toISOString(),
        notify_before_minutes: sub.notifyBeforeMinutes,
        status: sub.status,
      },
    };
  });

  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const { id } = request.params as { id: string };
    const row = await prisma.roomAlertSubscription.findFirst({ where: { id, userId } });
    if (!row) return reply.status(404).send({ error: 'Not found' });
    await prisma.roomAlertSubscription.update({
      where: { id },
      data: { status: AlertSubscriptionStatus.cancelled },
    });
    return { ok: true };
  });
};
