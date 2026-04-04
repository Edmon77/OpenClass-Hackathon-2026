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

function mapUser(
  u: {
    id: string;
    studentId: string;
    name: string;
    role: string;
    gender: string | null;
    facultyId: string | null;
    departmentId: string | null;
    program: string | null;
    fieldOfStudy: string | null;
    admissionType: string | null;
    year: number | null;
    section: string | null;
    forcePasswordChange: boolean;
  },
  names?: { faculty?: string | null; department?: string | null }
) {
  return {
    id: u.id,
    student_id: u.studentId,
    name: u.name,
    role: u.role,
    gender: u.gender,
    faculty_id: u.facultyId,
    faculty_name: names?.faculty ?? null,
    department_id: u.departmentId,
    department: names?.department ?? null,
    department_name: names?.department ?? null,
    program: u.program,
    field_of_study: u.fieldOfStudy,
    admission_type: u.admissionType,
    year: u.year,
    section: u.section,
    force_password_change: u.forcePasswordChange,
  };
}

function normalizePasswordInput(p: string): string {
  const t = p.trim();
  try {
    return t.normalize('NFKC');
  } catch {
    return t;
  }
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const studentId = parsed.data.studentId.trim().toUpperCase();
    const password = normalizePasswordInput(parsed.data.password);

    const user = await prisma.user.findUnique({
      where: { studentId },
      include: { faculty: true, department: true },
    });
    if (!user) {
      request.log.warn({ studentId }, 'login_failed_unknown_user');
      return reply.status(401).send({
        error: 'Invalid credentials',
        code: 'unknown_user',
        hint: 'No account with this ID. Run prisma db seed (or docker compose up so seed runs).',
      });
    }
    if (!user.isActive) {
      request.log.warn({ studentId }, 'login_failed_inactive');
      return reply.status(403).send({
        error: 'Account is disabled',
        code: 'inactive',
        hint: 'Ask an admin to re-activate this user.',
      });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      request.log.warn({ studentId }, 'login_failed_bad_password');
      return reply.status(401).send({
        error: 'Invalid credentials',
        code: 'bad_password',
        hint: 'Check password spelling (demo: Hackathon2026).',
      });
    }

    const token = await app.jwt.sign({ sub: user.id, role: user.role });
    return {
      accessToken: token,
      user: mapUser(user, { faculty: user.faculty?.name, department: user.department?.name }),
    };
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const sub = (request.user as { sub: string }).sub;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: sub },
      include: { faculty: true, department: true },
    });
    return { user: mapUser(user, { faculty: user.faculty?.name, department: user.department?.name }) };
  });

  app.post('/change-password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = changePwBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const sub = (request.user as { sub: string }).sub;
    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: sub },
      data: { passwordHash: hash, forcePasswordChange: false },
    });
    return { ok: true };
  });
};
