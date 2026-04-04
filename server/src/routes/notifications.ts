import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const userId = (request.user as { sub: string }).sub;
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        scheduled_time: n.scheduledTime?.toISOString() ?? null,
        delivered_at: n.deliveredAt?.toISOString() ?? null,
        is_read: n.isRead,
        booking_id: n.bookingId,
        created_at: n.createdAt.toISOString(),
      })),
    };
  });

  /** Static path before /:id so "read-all" is never captured as an id. */
  app.post('/read-all', { preHandler: [app.authenticate] }, async (request) => {
    const userId = (request.user as { sub: string }).sub;
    await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { ok: true };
  });

  app.patch('/:id/read', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const { id } = request.params as { id: string };
    const row = await prisma.notification.findFirst({ where: { id, userId } });
    if (!row) return reply.status(404).send({ error: 'Not found' });
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return { ok: true };
  });
};
