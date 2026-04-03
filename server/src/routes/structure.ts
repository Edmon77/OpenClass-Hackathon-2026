import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';

/** Faculty / department hierarchy for any authenticated user (admin, CR, etc.). */
export const structureRoutes: FastifyPluginAsync = async (app) => {
  app.get('/faculties', { preHandler: [app.authenticate] }, async () => {
    const rows = await prisma.faculty.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return { faculties: rows.map((f) => ({ id: f.id, name: f.name })) };
  });

  app.get('/departments', { preHandler: [app.authenticate] }, async (request, reply) => {
    const facultyId = String((request.query as { faculty_id?: string }).faculty_id ?? '').trim();
    if (!facultyId) return reply.status(400).send({ error: 'faculty_id required' });
    const rows = await prisma.department.findMany({
      where: { facultyId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { departments: rows.map((d) => ({ id: d.id, name: d.name, faculty_id: d.facultyId })) };
  });
};
