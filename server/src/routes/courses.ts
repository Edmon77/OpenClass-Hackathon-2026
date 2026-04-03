import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const createOfferingBody = z.object({
  courseName: z.string().min(1),
  courseCode: z.string().optional(),
  teacherStudentId: z.string().min(1).optional(),
});

export const coursesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/my-classes',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const role = (request.user as { role: string }).role;
      if (role !== 'student') return reply.status(403).send({ error: 'Students only' });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (!user.departmentId || user.year == null) {
        return { courses: [] };
      }

      const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
      if (!ay) return { courses: [] };

      const sectionFilter = user.section
        ? { OR: [{ section: user.section }, { section: null }] }
        : {};

      const offerings = await prisma.courseOffering.findMany({
        where: {
          academicYearId: ay.id,
          departmentId: user.departmentId,
          year: user.year,
          isActive: true,
          ...sectionFilter,
        },
        include: {
          course: true,
          teacher: { select: { name: true } },
          department: { select: { name: true } },
        },
        orderBy: { course: { courseName: 'asc' } },
      });

      return {
        courses: offerings.map((o) => ({
          id: o.id,
          course_name: o.course.courseName,
          course_code: o.course.courseCode,
          teacher_name: o.teacher?.name ?? null,
          department: o.department.name,
          year: o.year,
          class_section: o.section ?? '',
        })),
      };
    }
  );

  app.get('/bookable', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const role = (request.user as { role: string }).role;
    const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!ay) return { courses: [] };

    const mapOffering = (o: {
      id: string;
      year: number;
      section: string | null;
      course: { courseName: string; courseCode: string | null };
      department: { name: string };
    }) => ({
      id: o.id,
      course_name: o.course.courseName,
      course_code: o.course.courseCode,
      department: o.department.name,
      year: o.year,
      class_section: o.section ?? '',
    });

    if (role === 'admin') {
      const offerings = await prisma.courseOffering.findMany({
        where: { academicYearId: ay.id, isActive: true },
        include: { course: true, department: true },
        orderBy: { course: { courseName: 'asc' } },
      });
      return { courses: offerings.map(mapOffering) };
    }

    if (role === 'teacher') {
      const offerings = await prisma.courseOffering.findMany({
        where: { academicYearId: ay.id, isActive: true, teacherUserId: userId },
        include: { course: true, department: true },
        orderBy: { course: { courseName: 'asc' } },
      });
      return { courses: offerings.map(mapOffering) };
    }

    if (role === 'student') {
      const cr = await prisma.crAssignment.findFirst({
        where: { userId, academicYearId: ay.id, isActive: true },
      });
      if (!cr) return { courses: [] };
      const offerings = await prisma.courseOffering.findMany({
        where: {
          academicYearId: ay.id,
          isActive: true,
          departmentId: cr.departmentId,
          year: cr.year,
          section: cr.section,
        },
        include: { course: true, department: true },
        orderBy: { course: { courseName: 'asc' } },
      });
      return { courses: offerings.map(mapOffering) };
    }

    return reply.status(403).send({ error: 'Forbidden' });
  });

  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = createOfferingBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
    const userId = (request.user as { sub: string }).sub;
    const role = (request.user as { role: string }).role;
    if (role !== 'student') return reply.status(403).send({ error: 'CR only' });

    const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!ay) return reply.status(400).send({ error: 'No active academic year' });

    const cr = await prisma.crAssignment.findFirst({
      where: { userId, academicYearId: ay.id, isActive: true },
    });
    if (!cr) return reply.status(403).send({ error: 'Not a class rep' });

    let teacherId: string | undefined;
    if (parsed.data.teacherStudentId) {
      const teacher = await prisma.user.findFirst({
        where: { studentId: parsed.data.teacherStudentId.trim().toUpperCase(), role: 'teacher', isActive: true },
      });
      if (!teacher) return reply.status(404).send({ error: 'Teacher not found' });
      teacherId = teacher.id;
    }

    const course = await prisma.course.create({
      data: {
        courseName: parsed.data.courseName.trim(),
        courseCode: parsed.data.courseCode?.trim() ?? null,
      },
    });

    const offering = await prisma.courseOffering.create({
      data: {
        courseId: course.id,
        academicYearId: ay.id,
        departmentId: cr.departmentId,
        year: cr.year,
        section: cr.section,
        teacherUserId: teacherId ?? null,
        createdByCrUserId: userId,
      },
    });

    return {
      course: {
        id: offering.id,
        course_name: course.courseName,
      },
    };
  });

  const updateOfferingBody = z.object({
    courseName: z.string().min(1).optional(),
    courseCode: z.string().optional(),
    teacherStudentId: z.string().min(1).optional(),
  });

  app.put(
    '/offerings/:id/teacher',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = z.object({ teacherStudentId: z.string().min(1).nullable() }).safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
      const userId = (request.user as { sub: string }).sub;
      const role = (request.user as { role: string }).role;

      const { id } = request.params as { id: string };
      const offering = await prisma.courseOffering.findUnique({ where: { id } });
      if (!offering) return reply.status(404).send({ error: 'Not found' });

      const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
      if (!ay || offering.academicYearId !== ay.id) {
        return reply.status(400).send({ error: 'Offering not in active year' });
      }

      if (role === 'student') {
        const cr = await prisma.crAssignment.findFirst({
          where: {
            userId,
            academicYearId: ay.id,
            isActive: true,
            departmentId: offering.departmentId,
            year: offering.year,
            section: offering.section,
          },
        });
        if (!cr) return reply.status(403).send({ error: 'Forbidden' });
      } else if (role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      let teacherUserId: string | null = null;
      if (parsed.data.teacherStudentId) {
        const teacher = await prisma.user.findFirst({
          where: { studentId: parsed.data.teacherStudentId.trim().toUpperCase(), role: 'teacher', isActive: true },
        });
        if (!teacher) return reply.status(404).send({ error: 'Teacher not found' });
        teacherUserId = teacher.id;
      }

      await prisma.courseOffering.update({ where: { id }, data: { teacherUserId } });
      return { ok: true };
    }
  );

  /** CR: assign/remove student section within same department & year as CR assignment. */
  app.put(
    '/students/:id/section',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = z.object({ section: z.string().nullable() }).safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
      const userId = (request.user as { sub: string }).sub;
      const role = (request.user as { role: string }).role;
      if (role !== 'student') return reply.status(403).send({ error: 'Students only' });

      const { id: targetId } = request.params as { id: string };
      const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
      if (!ay) return reply.status(400).send({ error: 'No active academic year' });

      const cr = await prisma.crAssignment.findFirst({
        where: { userId, academicYearId: ay.id, isActive: true },
      });
      if (!cr) return reply.status(403).send({ error: 'Not a class rep' });

      const target = await prisma.user.findUnique({ where: { id: targetId } });
      if (!target || target.role !== 'student') return reply.status(404).send({ error: 'Student not found' });
      if (target.departmentId !== cr.departmentId || target.year !== cr.year) {
        return reply.status(403).send({ error: 'Student not in your cohort' });
      }

      const next = parsed.data.section?.trim() || null;
      if (cr.section && next !== null && next !== cr.section) {
        return reply.status(400).send({ error: `Section must be "${cr.section}" or cleared for your CR scope` });
      }

      await prisma.user.update({ where: { id: targetId }, data: { section: next } });
      return { ok: true };
    }
  );

  app.put(
    '/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = updateOfferingBody.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
      const userId = (request.user as { sub: string }).sub;
      const role = (request.user as { role: string }).role;
      if (role !== 'student') return reply.status(403).send({ error: 'CR only' });

      const { id } = request.params as { id: string };
      const offering = await prisma.courseOffering.findUnique({
        where: { id },
        include: { course: true },
      });
      if (!offering) return reply.status(404).send({ error: 'Course offering not found' });

      const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
      if (!ay || offering.academicYearId !== ay.id) {
        return reply.status(400).send({ error: 'Offering is not in active academic year' });
      }

      const cr = await prisma.crAssignment.findFirst({
        where: {
          userId,
          academicYearId: ay.id,
          isActive: true,
          departmentId: offering.departmentId,
          year: offering.year,
          section: offering.section,
        },
      });
      if (!cr) return reply.status(403).send({ error: 'Not a class rep for this scope' });

      let teacherUserId = offering.teacherUserId;
      if (parsed.data.teacherStudentId) {
        const teacher = await prisma.user.findFirst({
          where: { studentId: parsed.data.teacherStudentId.trim().toUpperCase(), role: 'teacher', isActive: true },
        });
        if (!teacher) return reply.status(404).send({ error: 'Teacher not found' });
        teacherUserId = teacher.id;
      }

      if (parsed.data.courseName || parsed.data.courseCode !== undefined) {
        await prisma.course.update({
          where: { id: offering.courseId },
          data: {
            courseName: parsed.data.courseName?.trim() ?? offering.course.courseName,
            courseCode:
              parsed.data.courseCode !== undefined ? parsed.data.courseCode.trim() || null : offering.course.courseCode,
          },
        });
      }

      await prisma.courseOffering.update({
        where: { id },
        data: { teacherUserId },
      });
      return { ok: true };
    }
  );

  app.delete(
    '/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const role = (request.user as { role: string }).role;
      if (role !== 'student') return reply.status(403).send({ error: 'CR only' });

      const { id } = request.params as { id: string };
      const offering = await prisma.courseOffering.findUnique({ where: { id } });
      if (!offering) return reply.status(404).send({ error: 'Course offering not found' });

      const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
      if (!ay || offering.academicYearId !== ay.id) {
        return reply.status(400).send({ error: 'Offering is not in active academic year' });
      }

      const cr = await prisma.crAssignment.findFirst({
        where: {
          userId,
          academicYearId: ay.id,
          isActive: true,
          departmentId: offering.departmentId,
          year: offering.year,
          section: offering.section,
        },
      });
      if (!cr) return reply.status(403).send({ error: 'Not a class rep for this scope' });

      await prisma.courseOffering.update({ where: { id }, data: { isActive: false } });
      return { ok: true };
    }
  );

  app.get('/cr-list', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const role = (request.user as { role: string }).role;
    if (role !== 'student') return reply.status(403).send({ error: 'Forbidden' });
    const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!ay) return { courses: [] };
    const cr = await prisma.crAssignment.findFirst({
      where: { userId, academicYearId: ay.id, isActive: true },
    });
    if (!cr) return reply.status(403).send({ error: 'Not a class rep' });

    const offerings = await prisma.courseOffering.findMany({
      where: {
        academicYearId: ay.id,
        departmentId: cr.departmentId,
        year: cr.year,
        section: cr.section,
      },
      include: { course: true, teacher: { select: { name: true, studentId: true } } },
      orderBy: { course: { courseName: 'asc' } },
    });
    return {
      courses: offerings.map((o) => ({
        id: o.id,
        course_name: o.course.courseName,
        course_code: o.course.courseCode,
        teacher_name: o.teacher?.name ?? null,
        teacher_student_id: o.teacher?.studentId ?? null,
      })),
    };
  });

  /** Search teachers by student ID or name (CR / admin flows). */
  app.get('/teachers/search', { preHandler: [app.authenticate] }, async (request) => {
    const q = String((request.query as { q?: string }).q ?? '').trim();
    if (q.length < 1) return { teachers: [] };
    const upper = q.toUpperCase();
    const teachers = await prisma.user.findMany({
      where: {
        role: 'teacher',
        isActive: true,
        OR: [{ studentId: { contains: upper } }, { name: { contains: q, mode: 'insensitive' } }],
      },
      take: 30,
      select: { id: true, studentId: true, name: true },
      orderBy: { studentId: 'asc' },
    });
    return {
      teachers: teachers.map((t) => ({
        id: t.id,
        student_id: t.studentId,
        name: t.name,
      })),
    };
  });

  /** CR: search students in same department + year (for adding to section). */
  app.get('/students/search', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const role = (request.user as { role: string }).role;
    if (role !== 'student') return reply.status(403).send({ error: 'Students only' });

    const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!ay) return { students: [] };

    const cr = await prisma.crAssignment.findFirst({
      where: { userId, academicYearId: ay.id, isActive: true },
    });
    if (!cr) return reply.status(403).send({ error: 'Not a class rep' });

    const q = String((request.query as { q?: string }).q ?? '').trim();
    if (q.length < 1) return { students: [] };

    const students = await prisma.user.findMany({
      where: {
        role: 'student',
        isActive: true,
        departmentId: cr.departmentId,
        year: cr.year,
        OR: [{ studentId: { contains: q.toUpperCase() } }, { name: { contains: q, mode: 'insensitive' } }],
      },
      take: 40,
      select: {
        id: true,
        studentId: true,
        name: true,
        section: true,
      },
      orderBy: { studentId: 'asc' },
    });
    return {
      students: students.map((s) => ({
        id: s.id,
        student_id: s.studentId,
        name: s.name,
        section: s.section,
      })),
    };
  });

};
