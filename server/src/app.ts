import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth.js';
import { buildingsRoutes } from './routes/buildings.js';
import { roomsRoutes } from './routes/rooms.js';
import { bookingsRoutes } from './routes/bookings.js';
import { coursesRoutes } from './routes/courses.js';
import { adminRoutes } from './routes/admin.js';
import { healthRoutes } from './routes/health.js';
import { notificationsRoutes } from './routes/notifications.js';
import { settingsRoutes } from './routes/settings.js';
import { roomAlertsRoutes } from './routes/roomAlerts.js';
import { structureRoutes } from './routes/structure.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  await app.register(jwt, {
    secret,
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
  });

  app.decorate(
    'authenticate',
    async function (this: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  );

  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(buildingsRoutes, { prefix: '/buildings' });
  await app.register(roomsRoutes, { prefix: '/rooms' });
  await app.register(bookingsRoutes, { prefix: '/bookings' });
  await app.register(coursesRoutes, { prefix: '/courses' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(notificationsRoutes, { prefix: '/notifications' });
  await app.register(settingsRoutes, { prefix: '/settings' });
  await app.register(roomAlertsRoutes, { prefix: '/room-alerts' });
  await app.register(structureRoutes, { prefix: '/structure' });

  return app;
}
