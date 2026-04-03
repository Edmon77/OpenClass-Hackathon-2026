import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const loginBody = z.object({
  studentId: z.string().min(1),
  password: z.string().min(1),
});

const changePwBody = z.object({
  newPassword: z.string().min(6),
});

function mapUser(u: {
  id: string;
  studentId: string;
  name: string;
  role: string;
  department: string | null;
  year: number | null;
  classSection: string | null;
  forcePasswordChange: boolean;
}) {
  return {
    id: u.id,
    student_id: u.studentId,
    name: u.name,
    role: u.role,
    department: u.department,
    year: u.year,
    class_section: u.classSection,
    force_password_change: u.forcePasswordChange,
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const studentId = parsed.data.studentId.trim().toUpperCase();
    const user = await prisma.user.findFirst({
      where: { studentId, isActive: true },
    });
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return reply.status(401).send({ error: 'Invalid credentials' });

    const token = await app.jwt.sign({ sub: user.id, role: user.role });
    return {
      accessToken: token,
      user: mapUser(user),
    };
  });

  app.get(
    '/me',
    { preHandler: [app.authenticate] },
    async (request) => {
      const sub = (request.user as { sub: string }).sub;
      const user = await prisma.user.findUniqueOrThrow({ where: { id: sub } });
      return { user: mapUser(user) };
    }
  );

  app.post(
    '/change-password',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = changePwBody.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
      const sub = (request.user as { sub: string }).sub;
      const hash = await bcrypt.hash(parsed.data.newPassword, 12);
      await prisma.user.update({
        where: { id: sub },
        data: { passwordHash: hash, forcePasswordChange: false },
      });
      return { ok: true };
    }
  );
};
