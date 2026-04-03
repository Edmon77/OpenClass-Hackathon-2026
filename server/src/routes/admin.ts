import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const createUserBody = z.object({
  studentId: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['student', 'teacher', 'admin']),
  department: z.string().optional(),
  year: z.number().optional(),
  classSection: z.string().optional(),
  forcePasswordChange: z.boolean().optional(),
});

const buildingBody = z.object({
  name: z.string().min(1),
  floorCount: z.number().int().min(1),
});

const roomBody = z.object({
  buildingId: z.string().uuid(),
  roomNumber: z.string().min(1),
  floorIndex: z.number().int().min(0),
  capacity: z.number().int().min(1),
  equipment: z.array(z.string()).optional(),
});

const crAssignBody = z.object({
  userId: z.string().uuid(),
  semesterId: z.string().uuid(),
  department: z.string().min(1),
  year: z.number().int(),
  classSection: z.string().min(1),
});

function adminOr403(request: FastifyRequest, reply: FastifyReply): boolean {
  const role = (request.user as { role: string }).role;
  if (role !== 'admin') {
    reply.status(403).send({ error: 'Admin only' });
    return false;
  }
  return true;
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/users', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const users = await prisma.user.findMany({
      orderBy: { studentId: 'asc' },
      select: {
        id: true,
        studentId: true,
        name: true,
        role: true,
        department: true,
        year: true,
        classSection: true,
        isActive: true,
        forcePasswordChange: true,
      },
    });
    return { users };
  });

  app.post('/users', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = createUserBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const d = parsed.data;
    const hash = await bcrypt.hash(d.password, 12);
    const user = await prisma.user.create({
      data: {
        studentId: d.studentId.trim().toUpperCase(),
        name: d.name,
        passwordHash: hash,
        role: d.role as Role,
        department: d.department ?? null,
        year: d.year ?? null,
        classSection: d.classSection ?? null,
        forcePasswordChange: d.forcePasswordChange ?? false,
      },
    });
    return { id: user.id, student_id: user.studentId };
  });

  app.post('/buildings', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = buildingBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const b = await prisma.building.create({
      data: { name: parsed.data.name, floorCount: parsed.data.floorCount },
    });
    return { id: b.id, building_name: b.name };
  });

  app.post('/rooms', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = roomBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const eq = parsed.data.equipment?.length ? JSON.stringify(parsed.data.equipment) : null;
    const r = await prisma.room.create({
      data: {
        roomNumber: parsed.data.roomNumber,
        buildingId: parsed.data.buildingId,
        floorIndex: parsed.data.floorIndex,
        capacity: parsed.data.capacity,
        equipmentJson: eq,
      },
    });
    return { id: r.id, room_number: r.roomNumber };
  });

  app.post('/cr-assignments', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = crAssignBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const row = await prisma.crAssignment.create({
      data: {
        userId: parsed.data.userId,
        semesterId: parsed.data.semesterId,
        department: parsed.data.department,
        year: parsed.data.year,
        classSection: parsed.data.classSection,
      },
    });
    return { id: row.id };
  });

  app.get('/semesters', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const semesters = await prisma.semester.findMany({ orderBy: { startDate: 'desc' } });
    return {
      semesters: semesters.map((s) => ({
        id: s.id,
        name: s.name,
        start_date: s.startDate.toISOString().slice(0, 10),
        end_date: s.endDate.toISOString().slice(0, 10),
        is_active: s.isActive,
      })),
    };
  });

  const semesterCreateBody = z.object({
    name: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  app.post('/semesters', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = semesterCreateBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body (name, startDate, endDate YYYY-MM-DD)' });
    const d = parsed.data;
    const start = new Date(`${d.startDate}T00:00:00.000Z`);
    const end = new Date(`${d.endDate}T00:00:00.000Z`);
    if (end < start) return reply.status(400).send({ error: 'endDate must be on or after startDate' });
    const sem = await prisma.semester.create({
      data: {
        name: d.name.trim(),
        startDate: start,
        endDate: end,
        isActive: false,
      },
    });
    return { id: sem.id, name: sem.name };
  });

  app.post('/semesters/:id/activate', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const exists = await prisma.semester.findFirst({ where: { id } });
    if (!exists) return reply.status(404).send({ error: 'Semester not found' });
    await prisma.$transaction(async (tx) => {
      const all = await tx.semester.findMany({ select: { id: true } });
      for (const s of all) {
        await tx.semester.update({
          where: { id: s.id },
          data: { isActive: s.id === id },
        });
      }
    });
    return { ok: true };
  });

  app.post('/semesters/:id/close', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const sem = await prisma.semester.findFirst({ where: { id } });
    if (!sem) return reply.status(404).send({ error: 'Semester not found' });
    await prisma.$transaction([
      prisma.semester.update({ where: { id }, data: { isActive: false } }),
      prisma.crAssignment.updateMany({ where: { semesterId: id }, data: { isActive: false } }),
      prisma.course.updateMany({ where: { semesterId: id }, data: { isActive: false } }),
    ]);
    return { ok: true };
  });

  const bulkUserRow = z.object({
    studentId: z.string().min(1),
    name: z.string().min(1),
    password: z.string().min(6),
    role: z.enum(['student', 'teacher', 'admin']).optional(),
    department: z.string().optional(),
    year: z.number().int().optional(),
    classSection: z.string().optional(),
    forcePasswordChange: z.boolean().optional(),
  });

  app.post('/users/bulk', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = z.object({ users: z.array(bulkUserRow).min(1).max(500) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body: users array (max 500)' });
    let created = 0;
    let updated = 0;
    for (const row of parsed.data.users) {
      const hash = await bcrypt.hash(row.password, 12);
      const sid = row.studentId.trim().toUpperCase();
      const role = (row.role ?? 'student') as Role;
      const existing = await prisma.user.findUnique({ where: { studentId: sid } });
      if (existing) {
        await prisma.user.update({
          where: { studentId: sid },
          data: {
            name: row.name,
            passwordHash: hash,
            role,
            department: row.department ?? null,
            year: row.year ?? null,
            classSection: row.classSection ?? null,
            forcePasswordChange: row.forcePasswordChange ?? existing.forcePasswordChange,
          },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: {
            studentId: sid,
            name: row.name,
            passwordHash: hash,
            role,
            department: row.department ?? null,
            year: row.year ?? null,
            classSection: row.classSection ?? null,
            forcePasswordChange: row.forcePasswordChange ?? false,
          },
        });
        created++;
      }
    }
    return { ok: true, created, updated };
  });
};
