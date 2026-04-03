import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role, RoomType, type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const createUserBody = z.object({
  studentId: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['student', 'teacher', 'admin']),
  gender: z.string().optional(),
  facultyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  program: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  admissionType: z.string().optional(),
  year: z.number().int().optional(),
  section: z.string().optional(),
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
  roomType: z.nativeEnum(RoomType).optional(),
  hasProjector: z.boolean().optional(),
  hasInternet: z.boolean().optional(),
  hasPower: z.boolean().optional(),
  equipment: z.array(z.string()).optional(),
});

const crAssignBody = z.object({
  userId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  departmentId: z.string().uuid(),
  year: z.number().int(),
  section: z.string().nullable().optional(),
});

const facultyBody = z.object({ name: z.string().min(1) });
const departmentBody = z.object({
  facultyId: z.string().uuid(),
  name: z.string().min(1),
});

const catalogCourseBody = z.object({
  courseName: z.string().min(1),
  courseCode: z.string().optional(),
});

const offeringBody = z.object({
  courseId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  departmentId: z.string().uuid(),
  year: z.number().int(),
  section: z.string().nullable().optional(),
  teacherStudentId: z.string().optional(),
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

  app.get('/faculties', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const rows = await prisma.faculty.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return { faculties: rows.map((f) => ({ id: f.id, name: f.name })) };
  });

  app.post('/faculties', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = facultyBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const f = await prisma.faculty.create({ data: { name: parsed.data.name.trim() } });
    return { id: f.id, name: f.name };
  });

  app.get('/departments', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const facultyId = String((request.query as { faculty_id?: string }).faculty_id ?? '').trim();
    if (!facultyId) return reply.status(400).send({ error: 'faculty_id required' });
    const rows = await prisma.department.findMany({
      where: { facultyId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { departments: rows.map((d) => ({ id: d.id, name: d.name, faculty_id: d.facultyId })) };
  });

  app.post('/departments', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = departmentBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const d = await prisma.department.create({
      data: { name: parsed.data.name.trim(), facultyId: parsed.data.facultyId },
    });
    return { id: d.id, name: d.name };
  });

  app.get('/users', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const q = request.query as {
      faculty_id?: string;
      department_id?: string;
      year?: string;
      role?: string;
      search?: string;
      skip?: string;
      take?: string;
    };
    const take = Math.min(100, Math.max(1, parseInt(q.take ?? '50', 10) || 50));
    const skip = Math.max(0, parseInt(q.skip ?? '0', 10) || 0);

    const where: Prisma.UserWhereInput = {};

    if (q.department_id) where.departmentId = q.department_id;
    else if (q.faculty_id) where.facultyId = q.faculty_id;

    if (q.year) {
      const y = parseInt(q.year, 10);
      if (Number.isFinite(y)) where.year = y;
    }
    if (q.role && ['student', 'teacher', 'admin'].includes(q.role)) {
      where.role = q.role as Role;
    }
    const search = (q.search ?? '').trim();
    if (search.length > 0) {
      where.OR = [
        { studentId: { contains: search.toUpperCase() } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (!q.faculty_id && !q.department_id && !search) {
      return reply.status(400).send({
        error: 'Filter required: faculty_id, department_id, or search',
      });
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { studentId: 'asc' },
        skip,
        take,
        include: { faculty: { select: { name: true } }, department: { select: { name: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        studentId: u.studentId,
        name: u.name,
        role: u.role,
        gender: u.gender,
        faculty_id: u.facultyId,
        faculty_name: u.faculty?.name ?? null,
        department_id: u.departmentId,
        department_name: u.department?.name ?? null,
        program: u.program,
        field_of_study: u.fieldOfStudy,
        admission_type: u.admissionType,
        year: u.year,
        section: u.section,
        isActive: u.isActive,
        forcePasswordChange: u.forcePasswordChange,
      })),
      total,
      skip,
      take,
    };
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
        gender: d.gender ?? null,
        facultyId: d.facultyId ?? null,
        departmentId: d.departmentId ?? null,
        program: d.program ?? null,
        fieldOfStudy: d.fieldOfStudy ?? null,
        admissionType: d.admissionType ?? null,
        year: d.year ?? null,
        section: d.section ?? null,
        forcePasswordChange: d.forcePasswordChange ?? false,
      },
    });
    return { id: user.id, student_id: user.studentId };
  });

  const userUpdate = z.object({
    name: z.string().min(1).optional(),
    role: z.enum(['student', 'teacher', 'admin']).optional(),
    gender: z.string().nullable().optional(),
    facultyId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    program: z.string().nullable().optional(),
    fieldOfStudy: z.string().nullable().optional(),
    admissionType: z.string().nullable().optional(),
    year: z.number().int().nullable().optional(),
    section: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    forcePasswordChange: z.boolean().optional(),
    password: z.string().min(6).optional(),
  });

  app.put('/users/:id', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = userUpdate.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const d = parsed.data;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'User not found' });

    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.role !== undefined) data.role = d.role as Role;
    if (d.gender !== undefined) data.gender = d.gender;
    if (d.facultyId !== undefined) data.facultyId = d.facultyId;
    if (d.departmentId !== undefined) data.departmentId = d.departmentId;
    if (d.program !== undefined) data.program = d.program;
    if (d.fieldOfStudy !== undefined) data.fieldOfStudy = d.fieldOfStudy;
    if (d.admissionType !== undefined) data.admissionType = d.admissionType;
    if (d.year !== undefined) data.year = d.year;
    if (d.section !== undefined) data.section = d.section;
    if (d.isActive !== undefined) data.isActive = d.isActive;
    if (d.forcePasswordChange !== undefined) data.forcePasswordChange = d.forcePasswordChange;
    if (d.password) data.passwordHash = await bcrypt.hash(d.password, 12);

    await prisma.user.update({ where: { id }, data });
    return { ok: true };
  });

  const bulkUserRow = z.object({
    studentId: z.string().min(1),
    name: z.string().min(1),
    password: z.string().min(6),
    role: z.enum(['student', 'teacher', 'admin']).optional(),
    gender: z.string().optional(),
    faculty: z.string().optional(),
    department: z.string().optional(),
    program: z.string().optional(),
    fieldOfStudy: z.string().optional(),
    admissionType: z.string().optional(),
    year: z.number().int().optional(),
    section: z.string().optional(),
    forcePasswordChange: z.boolean().optional(),
  });

  app.post('/users/bulk', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = z.object({ users: z.array(bulkUserRow).min(1).max(500) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    let created = 0;
    let updated = 0;

    const facultyCache = new Map<string, string>();
    const deptCache = new Map<string, string>();

    async function resolveFaculty(name: string | undefined): Promise<string | null> {
      if (!name?.trim()) return null;
      const key = name.trim();
      if (facultyCache.has(key)) return facultyCache.get(key)!;
      const f = await prisma.faculty.findFirst({ where: { name: key } });
      if (!f) return null;
      facultyCache.set(key, f.id);
      return f.id;
    }

    async function resolveDept(facultyName: string | undefined, deptName: string | undefined): Promise<string | null> {
      if (!facultyName?.trim() || !deptName?.trim()) return null;
      const cacheKey = `${facultyName.trim()}|${deptName.trim()}`;
      if (deptCache.has(cacheKey)) return deptCache.get(cacheKey)!;
      const fac = await prisma.faculty.findFirst({ where: { name: facultyName.trim() } });
      if (!fac) return null;
      const d = await prisma.department.findFirst({
        where: { facultyId: fac.id, name: deptName.trim() },
      });
      if (!d) return null;
      deptCache.set(cacheKey, d.id);
      return d.id;
    }

    for (const row of parsed.data.users) {
      const hash = await bcrypt.hash(row.password, 12);
      const sid = row.studentId.trim().toUpperCase();
      const role = (row.role ?? 'student') as Role;
      const facultyId = await resolveFaculty(row.faculty);
      const departmentId = await resolveDept(row.faculty, row.department);

      const existing = await prisma.user.findUnique({ where: { studentId: sid } });
      const common = {
        name: row.name,
        passwordHash: hash,
        role,
        gender: row.gender ?? null,
        facultyId,
        departmentId,
        program: row.program ?? null,
        fieldOfStudy: row.fieldOfStudy ?? null,
        admissionType: row.admissionType ?? null,
        year: row.year ?? null,
        section: row.section ?? null,
        forcePasswordChange: row.forcePasswordChange ?? existing?.forcePasswordChange ?? false,
      };

      if (existing) {
        await prisma.user.update({ where: { studentId: sid }, data: common });
        updated++;
      } else {
        await prisma.user.create({ data: { studentId: sid, ...common } });
        created++;
      }
    }
    return { ok: true, created, updated };
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
    const d = parsed.data;
    const eq = d.equipment?.length ? JSON.stringify(d.equipment) : null;
    const r = await prisma.room.create({
      data: {
        roomNumber: d.roomNumber,
        buildingId: d.buildingId,
        floorIndex: d.floorIndex,
        capacity: d.capacity,
        roomType: d.roomType ?? RoomType.lecture_hall,
        hasProjector: d.hasProjector ?? false,
        hasInternet: d.hasInternet ?? false,
        hasPower: d.hasPower ?? true,
        equipmentJson: eq,
      },
    });
    return { id: r.id, room_number: r.roomNumber };
  });

  app.get('/cr-assignments', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const q = request.query as { academic_year_id?: string; department_id?: string };
    const ayId = q.academic_year_id?.trim();
    const deptId = q.department_id?.trim();
    if (!ayId) return reply.status(400).send({ error: 'academic_year_id required' });

    const where: Record<string, unknown> = { academicYearId: ayId };
    if (deptId) where.departmentId = deptId;

    const rows = await prisma.crAssignment.findMany({
      where,
      include: { user: { select: { name: true, studentId: true } }, department: { select: { name: true } } },
      orderBy: { year: 'asc' },
    });
    return {
      assignments: rows.map((r) => ({
        id: r.id,
        user_id: r.userId,
        user_name: r.user.name,
        student_id: r.user.studentId,
        department_name: r.department.name,
        year: r.year,
        section: r.section,
        is_active: r.isActive,
      })),
    };
  });

  app.post('/cr-assignments', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = crAssignBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const d = parsed.data;
    const row = await prisma.crAssignment.create({
      data: {
        userId: d.userId,
        academicYearId: d.academicYearId,
        departmentId: d.departmentId,
        year: d.year,
        section: d.section ?? null,
      },
    });
    return { id: row.id };
  });

  const yearCreateBody = z.object({
    name: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  app.get('/academic-years', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const years = await prisma.academicYear.findMany({ orderBy: { startDate: 'desc' } });
    return {
      academic_years: years.map((y) => ({
        id: y.id,
        name: y.name,
        start_date: y.startDate.toISOString().slice(0, 10),
        end_date: y.endDate.toISOString().slice(0, 10),
        is_active: y.isActive,
      })),
    };
  });

  app.post('/academic-years', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = yearCreateBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body (name, startDate, endDate YYYY-MM-DD)' });
    const d = parsed.data;
    const start = new Date(`${d.startDate}T00:00:00.000Z`);
    const end = new Date(`${d.endDate}T00:00:00.000Z`);
    if (end < start) return reply.status(400).send({ error: 'endDate must be on or after startDate' });
    const y = await prisma.academicYear.create({
      data: {
        name: d.name.trim(),
        startDate: start,
        endDate: end,
        isActive: false,
      },
    });
    return { id: y.id, name: y.name };
  });

  app.post('/academic-years/:id/activate', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const exists = await prisma.academicYear.findFirst({ where: { id } });
    if (!exists) return reply.status(404).send({ error: 'Academic year not found' });
    await prisma.$transaction(async (tx) => {
      const all = await tx.academicYear.findMany({ select: { id: true } });
      for (const ay of all) {
        await tx.academicYear.update({
          where: { id: ay.id },
          data: { isActive: ay.id === id },
        });
      }
    });
    return { ok: true };
  });

  app.post('/academic-years/:id/close', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const ay = await prisma.academicYear.findFirst({ where: { id } });
    if (!ay) return reply.status(404).send({ error: 'Not found' });
    await prisma.$transaction([
      prisma.academicYear.update({ where: { id }, data: { isActive: false } }),
      prisma.crAssignment.updateMany({ where: { academicYearId: id }, data: { isActive: false } }),
      prisma.courseOffering.updateMany({ where: { academicYearId: id }, data: { isActive: false } }),
    ]);
    return { ok: true };
  });

  /** Legacy alias */
  app.get('/semesters', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const years = await prisma.academicYear.findMany({ orderBy: { startDate: 'desc' } });
    return {
      semesters: years.map((y) => ({
        id: y.id,
        name: y.name,
        start_date: y.startDate.toISOString().slice(0, 10),
        end_date: y.endDate.toISOString().slice(0, 10),
        is_active: y.isActive,
      })),
    };
  });

  app.post('/semesters', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = yearCreateBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const d = parsed.data;
    const start = new Date(`${d.startDate}T00:00:00.000Z`);
    const end = new Date(`${d.endDate}T00:00:00.000Z`);
    if (end < start) return reply.status(400).send({ error: 'endDate must be on or after startDate' });
    const y = await prisma.academicYear.create({
      data: { name: d.name.trim(), startDate: start, endDate: end, isActive: false },
    });
    return { id: y.id, name: y.name };
  });

  app.post('/semesters/:id/activate', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!adminOr403(request, reply)) return;
    const exists = await prisma.academicYear.findFirst({ where: { id } });
    if (!exists) return reply.status(404).send({ error: 'Not found' });
    await prisma.$transaction(async (tx) => {
      const all = await tx.academicYear.findMany({ select: { id: true } });
      for (const ay of all) {
        await tx.academicYear.update({ where: { id: ay.id }, data: { isActive: ay.id === id } });
      }
    });
    return { ok: true };
  });

  app.post('/semesters/:id/close', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!adminOr403(request, reply)) return;
    const ay = await prisma.academicYear.findFirst({ where: { id } });
    if (!ay) return reply.status(404).send({ error: 'Not found' });
    await prisma.$transaction([
      prisma.academicYear.update({ where: { id }, data: { isActive: false } }),
      prisma.crAssignment.updateMany({ where: { academicYearId: id }, data: { isActive: false } }),
      prisma.courseOffering.updateMany({ where: { academicYearId: id }, data: { isActive: false } }),
    ]);
    return { ok: true };
  });

  app.get('/catalog/courses', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const courses = await prisma.course.findMany({ orderBy: { courseName: 'asc' } });
    return {
      courses: courses.map((c) => ({
        id: c.id,
        course_name: c.courseName,
        course_code: c.courseCode,
        is_active: c.isActive,
      })),
    };
  });

  app.post('/catalog/courses', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = catalogCourseBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const c = await prisma.course.create({
      data: {
        courseName: parsed.data.courseName.trim(),
        courseCode: parsed.data.courseCode?.trim() ?? null,
      },
    });
    return { id: c.id, course_name: c.courseName };
  });

  app.put('/catalog/courses/:id', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = catalogCourseBody.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const ex = await prisma.course.findUnique({ where: { id } });
    if (!ex) return reply.status(404).send({ error: 'Not found' });
    await prisma.course.update({
      where: { id },
      data: {
        courseName: parsed.data.courseName?.trim() ?? ex.courseName,
        courseCode: parsed.data.courseCode !== undefined ? parsed.data.courseCode.trim() || null : ex.courseCode,
      },
    });
    return { ok: true };
  });

  app.delete('/catalog/courses/:id', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const ex = await prisma.course.findUnique({ where: { id } });
    if (!ex) return reply.status(404).send({ error: 'Not found' });
    await prisma.course.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  });

  app.get('/course-offerings', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const ayId = String((request.query as { academic_year_id?: string }).academic_year_id ?? '').trim();
    if (!ayId) return reply.status(400).send({ error: 'academic_year_id required' });
    const rows = await prisma.courseOffering.findMany({
      where: { academicYearId: ayId },
      include: {
        course: true,
        department: true,
        teacher: { select: { name: true, studentId: true } },
      },
      orderBy: { course: { courseName: 'asc' } },
    });
    return {
      offerings: rows.map((o) => ({
        id: o.id,
        course_id: o.courseId,
        course_name: o.course.courseName,
        course_code: o.course.courseCode,
        department_id: o.departmentId,
        department_name: o.department.name,
        year: o.year,
        section: o.section,
        teacher_name: o.teacher?.name ?? null,
        teacher_student_id: o.teacher?.studentId ?? null,
        is_active: o.isActive,
      })),
    };
  });

  app.post('/course-offerings', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = offeringBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const d = parsed.data;
    let teacherUserId: string | null = null;
    if (d.teacherStudentId) {
      const t = await prisma.user.findFirst({
        where: { studentId: d.teacherStudentId.trim().toUpperCase(), role: 'teacher', isActive: true },
      });
      if (!t) return reply.status(404).send({ error: 'Teacher not found' });
      teacherUserId = t.id;
    }
    const o = await prisma.courseOffering.create({
      data: {
        courseId: d.courseId,
        academicYearId: d.academicYearId,
        departmentId: d.departmentId,
        year: d.year,
        section: d.section ?? null,
        teacherUserId,
      },
    });
    return { id: o.id };
  });

  app.put('/course-offerings/:id', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = offeringBody.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const ex = await prisma.courseOffering.findUnique({ where: { id } });
    if (!ex) return reply.status(404).send({ error: 'Not found' });
    let teacherUserId = ex.teacherUserId;
    if (parsed.data.teacherStudentId !== undefined) {
      if (!parsed.data.teacherStudentId) teacherUserId = null;
      else {
        const t = await prisma.user.findFirst({
          where: { studentId: parsed.data.teacherStudentId.trim().toUpperCase(), role: 'teacher', isActive: true },
        });
        if (!t) return reply.status(404).send({ error: 'Teacher not found' });
        teacherUserId = t.id;
      }
    }
    await prisma.courseOffering.update({
      where: { id },
      data: {
        year: parsed.data.year ?? ex.year,
        section: parsed.data.section !== undefined ? parsed.data.section : ex.section,
        teacherUserId,
        departmentId: parsed.data.departmentId ?? ex.departmentId,
        isActive: true,
      },
    });
    return { ok: true };
  });

  app.delete('/course-offerings/:id', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const ex = await prisma.courseOffering.findUnique({ where: { id } });
    if (!ex) return reply.status(404).send({ error: 'Not found' });
    await prisma.courseOffering.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  });

  const bulkOfferingRow = z.object({
    courseCode: z.string().min(1),
    department: z.string().min(1),
    faculty: z.string().min(1),
    year: z.number().int(),
    section: z.string().optional(),
    teacherStudentId: z.string().optional(),
  });

  app.post('/course-offerings/bulk', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = z.object({ offerings: z.array(bulkOfferingRow).min(1).max(500) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!ay) return reply.status(400).send({ error: 'No active academic year' });

    let created = 0;
    let skipped = 0;

    for (const row of parsed.data.offerings) {
      const faculty = await prisma.faculty.findFirst({ where: { name: row.faculty.trim() } });
      if (!faculty) {
        skipped++;
        continue;
      }
      const dept = await prisma.department.findFirst({
        where: { facultyId: faculty.id, name: row.department.trim() },
      });
      if (!dept) {
        skipped++;
        continue;
      }
      const course = await prisma.course.findFirst({
        where: { courseCode: row.courseCode.trim() },
      });
      if (!course) {
        skipped++;
        continue;
      }

      let teacherUserId: string | null = null;
      if (row.teacherStudentId) {
        const t = await prisma.user.findFirst({
          where: { studentId: row.teacherStudentId.trim().toUpperCase(), role: 'teacher', isActive: true },
        });
        if (t) teacherUserId = t.id;
      }

      await prisma.courseOffering.create({
        data: {
          courseId: course.id,
          academicYearId: ay.id,
          departmentId: dept.id,
          year: row.year,
          section: row.section?.trim() ?? null,
          teacherUserId,
        },
      });
      created++;
    }
    return { ok: true, created, skipped };
  });

  /** Legacy: old admin courses screen — map to catalog + offerings */
  app.get('/courses', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
    const offerings = ay
      ? await prisma.courseOffering.findMany({
          where: { academicYearId: ay.id },
          include: {
            course: true,
            department: { include: { faculty: true } },
            teacher: { select: { name: true, studentId: true } },
            academicYear: true,
          },
          orderBy: { course: { courseName: 'asc' } },
        })
      : [];
    return {
      courses: offerings.map((o) => ({
        id: o.id,
        course_name: o.course.courseName,
        course_code: o.course.courseCode,
        faculty_name: o.department.faculty?.name ?? '',
        department: o.department.name,
        year: o.year,
        class_section: o.section ?? '',
        teacher_name: o.teacher?.name ?? null,
        teacher_student_id: o.teacher?.studentId ?? null,
        semester_name: o.academicYear.name,
        semester_id: o.academicYearId,
        is_active: o.isActive,
      })),
    };
  });

  app.post('/courses', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = z
      .object({
        courseName: z.string().min(1),
        courseCode: z.string().optional(),
        teacherStudentId: z.string().optional(),
        department: z.string().min(1),
        faculty: z.string().min(1),
        year: z.number().int(),
        classSection: z.string().optional(),
        semesterId: z.string().uuid().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const d = parsed.data;

    let ayId = d.semesterId;
    if (!ayId) {
      const active = await prisma.academicYear.findFirst({ where: { isActive: true } });
      if (!active) return reply.status(400).send({ error: 'No active academic year' });
      ayId = active.id;
    }

    const faculty = await prisma.faculty.findFirst({ where: { name: d.faculty.trim() } });
    if (!faculty) return reply.status(404).send({ error: 'Faculty not found' });
    const dept = await prisma.department.findFirst({
      where: { facultyId: faculty.id, name: d.department.trim() },
    });
    if (!dept) return reply.status(404).send({ error: 'Department not found' });

    let teacherUserId: string | null = null;
    if (d.teacherStudentId) {
      const t = await prisma.user.findFirst({
        where: { studentId: d.teacherStudentId.trim().toUpperCase(), role: 'teacher', isActive: true },
      });
      if (!t) return reply.status(404).send({ error: 'Teacher not found' });
      teacherUserId = t.id;
    }

    const course = await prisma.course.create({
      data: {
        courseName: d.courseName.trim(),
        courseCode: d.courseCode?.trim() ?? null,
      },
    });

    const o = await prisma.courseOffering.create({
      data: {
        courseId: course.id,
        academicYearId: ayId,
        departmentId: dept.id,
        year: d.year,
        section: d.classSection?.trim() ?? null,
        teacherUserId,
      },
    });

    return { id: o.id, course_name: course.courseName };
  });

  app.put('/courses/:id', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        courseName: z.string().min(1).optional(),
        courseCode: z.string().optional(),
        teacherStudentId: z.string().optional(),
        department: z.string().min(1).optional(),
        faculty: z.string().optional(),
        year: z.number().int().optional(),
        classSection: z.string().optional(),
        isActive: z.boolean().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const offering = await prisma.courseOffering.findUnique({
      where: { id },
      include: { course: true },
    });
    if (!offering) return reply.status(404).send({ error: 'Course offering not found' });

    let departmentId = offering.departmentId;
    if (parsed.data.faculty && parsed.data.department) {
      const faculty = await prisma.faculty.findFirst({ where: { name: parsed.data.faculty.trim() } });
      if (!faculty) return reply.status(404).send({ error: 'Faculty not found' });
      const dept = await prisma.department.findFirst({
        where: { facultyId: faculty.id, name: parsed.data.department.trim() },
      });
      if (!dept) return reply.status(404).send({ error: 'Department not found' });
      departmentId = dept.id;
    }

    let teacherUserId = offering.teacherUserId;
    if (parsed.data.teacherStudentId !== undefined) {
      if (!parsed.data.teacherStudentId) teacherUserId = null;
      else {
        const t = await prisma.user.findFirst({
          where: { studentId: parsed.data.teacherStudentId.trim().toUpperCase(), role: 'teacher', isActive: true },
        });
        if (!t) return reply.status(404).send({ error: 'Teacher not found' });
        teacherUserId = t.id;
      }
    }

    await prisma.course.update({
      where: { id: offering.courseId },
      data: {
        courseName: parsed.data.courseName?.trim() ?? offering.course.courseName,
        courseCode:
          parsed.data.courseCode !== undefined ? parsed.data.courseCode.trim() || null : offering.course.courseCode,
      },
    });

    await prisma.courseOffering.update({
      where: { id },
      data: {
        departmentId,
        year: parsed.data.year ?? offering.year,
        section: parsed.data.classSection !== undefined ? parsed.data.classSection : offering.section,
        teacherUserId,
        isActive: parsed.data.isActive ?? offering.isActive,
      },
    });
    return { ok: true };
  });

  app.delete('/courses/:id', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const { id } = request.params as { id: string };
    const ex = await prisma.courseOffering.findUnique({ where: { id } });
    if (!ex) return reply.status(404).send({ error: 'Not found' });
    await prisma.courseOffering.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  });

  app.post('/courses/bulk', async (request, reply) => {
    if (!adminOr403(request, reply)) return;
    const parsed = z
      .object({
        courses: z
          .array(
            z.object({
              courseName: z.string().min(1),
              courseCode: z.string().optional(),
              teacherStudentId: z.string().optional(),
              faculty: z.string().min(1),
              department: z.string().min(1),
              year: z.number().int(),
              classSection: z.string().optional(),
            })
          )
          .min(1)
          .max(500),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!ay) return reply.status(400).send({ error: 'No active academic year' });

    let created = 0;
    let skipped = 0;
    for (const row of parsed.data.courses) {
      const faculty = await prisma.faculty.findFirst({ where: { name: row.faculty.trim() } });
      if (!faculty) {
        skipped++;
        continue;
      }
      const dept = await prisma.department.findFirst({
        where: { facultyId: faculty.id, name: row.department.trim() },
      });
      if (!dept) {
        skipped++;
        continue;
      }

      let teacherUserId: string | null = null;
      if (row.teacherStudentId) {
        const t = await prisma.user.findFirst({
          where: { studentId: row.teacherStudentId.trim().toUpperCase(), role: 'teacher', isActive: true },
        });
        if (t) teacherUserId = t.id;
      }

      const course = await prisma.course.create({
        data: {
          courseName: row.courseName.trim(),
          courseCode: row.courseCode?.trim() ?? null,
        },
      });

      await prisma.courseOffering.create({
        data: {
          courseId: course.id,
          academicYearId: ay.id,
          departmentId: dept.id,
          year: row.year,
          section: row.classSection?.trim() ?? null,
          teacherUserId,
        },
      });
      created++;
    }
    return { ok: true, created, skipped };
  });
};
