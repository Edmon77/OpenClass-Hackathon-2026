import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const createBody = z.object({
  courseName: z.string().min(1),
  teacherStudentId: z.string().min(1),
  teacherContact: z.string().optional(),
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
      if (!user.department || user.year == null || !user.classSection) {
        return { courses: [] };
      }

      const sem = await prisma.semester.findFirst({ where: { isActive: true } });
      if (!sem) return { courses: [] };

      const courses = await prisma.course.findMany({
        where: {
          semesterId: sem.id,
          department: user.department,
          year: user.year,
          classSection: user.classSection,
          isActive: true,
        },
        include: { teacher: { select: { name: true } } },
        orderBy: { courseName: 'asc' },
      });

      return {
        courses: courses.map((c) => ({
          id: c.id,
          course_name: c.courseName,
          teacher_name: c.teacher.name,
          department: c.department,
          year: c.year,
          class_section: c.classSection,
        })),
      };
    }
  );

  app.get(
    '/bookable',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const role = (request.user as { role: string }).role;
      const sem = await prisma.semester.findFirst({ where: { isActive: true } });
      if (!sem) return { courses: [] };

      if (role === 'admin') {
        const courses = await prisma.course.findMany({
          where: { semesterId: sem.id, isActive: true },
          orderBy: { courseName: 'asc' },
        });
        return {
          courses: courses.map((c) => ({
            id: c.id,
            course_name: c.courseName,
            department: c.department,
            year: c.year,
            class_section: c.classSection,
          })),
        };
      }

      if (role === 'teacher') {
        const courses = await prisma.course.findMany({
          where: { teacherUserId: userId, semesterId: sem.id, isActive: true },
          orderBy: { courseName: 'asc' },
        });
        return {
          courses: courses.map((c) => ({
            id: c.id,
            course_name: c.courseName,
            department: c.department,
            year: c.year,
            class_section: c.classSection,
          })),
        };
      }

      if (role === 'student') {
        const cr = await prisma.crAssignment.findFirst({
          where: { userId, semesterId: sem.id, isActive: true },
        });
        if (!cr) return { courses: [] };
        const courses = await prisma.course.findMany({
          where: {
            semesterId: sem.id,
            department: cr.department,
            year: cr.year,
            classSection: cr.classSection,
            isActive: true,
          },
          orderBy: { courseName: 'asc' },
        });
        return {
          courses: courses.map((c) => ({
            id: c.id,
            course_name: c.courseName,
            department: c.department,
            year: c.year,
            class_section: c.classSection,
          })),
        };
      }

      return reply.status(403).send({ error: 'Forbidden' });
    }
  );

  app.post(
    '/',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createBody.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
      const userId = (request.user as { sub: string }).sub;
      const role = (request.user as { role: string }).role;
      if (role !== 'student') return reply.status(403).send({ error: 'CR only' });

      const sem = await prisma.semester.findFirst({ where: { isActive: true } });
      if (!sem) return reply.status(400).send({ error: 'No active semester' });

      const cr = await prisma.crAssignment.findFirst({
        where: { userId, semesterId: sem.id, isActive: true },
      });
      if (!cr) return reply.status(403).send({ error: 'Not a class rep' });

      const teacherId = parsed.data.teacherStudentId.trim().toUpperCase();
      const teacher = await prisma.user.findFirst({
        where: { studentId: teacherId, role: 'teacher', isActive: true },
      });
      if (!teacher) return reply.status(404).send({ error: 'Teacher not found' });

      const course = await prisma.course.create({
        data: {
          courseName: parsed.data.courseName.trim(),
          department: cr.department,
          year: cr.year,
          classSection: cr.classSection,
          semesterId: sem.id,
          teacherUserId: teacher.id,
          teacherContact: parsed.data.teacherContact ?? null,
          createdByCrUserId: userId,
        },
      });

      return {
        course: {
          id: course.id,
          course_name: course.courseName,
        },
      };
    }
  );

  const updateBody = z.object({
    courseName: z.string().min(1).optional(),
    teacherStudentId: z.string().min(1).optional(),
    teacherContact: z.string().optional(),
  });

  app.put(
    '/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = updateBody.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });
      const userId = (request.user as { sub: string }).sub;
      const role = (request.user as { role: string }).role;
      if (role !== 'student') return reply.status(403).send({ error: 'CR only' });

      const { id } = request.params as { id: string };
      const course = await prisma.course.findUnique({ where: { id } });
      if (!course) return reply.status(404).send({ error: 'Course not found' });

      const sem = await prisma.semester.findFirst({ where: { isActive: true } });
      if (!sem || course.semesterId !== sem.id) return reply.status(400).send({ error: 'Course is not in active semester' });

      const cr = await prisma.crAssignment.findFirst({
        where: { userId, semesterId: sem.id, isActive: true, department: course.department, year: course.year, classSection: course.classSection },
      });
      if (!cr) return reply.status(403).send({ error: 'Not a class rep for this course scope' });

      let teacherUserId = course.teacherUserId;
      if (parsed.data.teacherStudentId) {
        const teacher = await prisma.user.findFirst({
          where: { studentId: parsed.data.teacherStudentId.trim().toUpperCase(), role: 'teacher', isActive: true },
        });
        if (!teacher) return reply.status(404).send({ error: 'Teacher not found' });
        teacherUserId = teacher.id;
      }

      await prisma.course.update({
        where: { id },
        data: {
          courseName: parsed.data.courseName?.trim() ?? course.courseName,
          teacherUserId,
          teacherContact: parsed.data.teacherContact?.trim() ?? course.teacherContact,
        },
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
      const course = await prisma.course.findUnique({ where: { id } });
      if (!course) return reply.status(404).send({ error: 'Course not found' });

      const sem = await prisma.semester.findFirst({ where: { isActive: true } });
      if (!sem || course.semesterId !== sem.id) return reply.status(400).send({ error: 'Course is not in active semester' });

      const cr = await prisma.crAssignment.findFirst({
        where: { userId, semesterId: sem.id, isActive: true, department: course.department, year: course.year, classSection: course.classSection },
      });
      if (!cr) return reply.status(403).send({ error: 'Not a class rep for this course scope' });

      await prisma.course.update({ where: { id }, data: { isActive: false } });
      return { ok: true };
    }
  );

  app.get(
    '/cr-list',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const role = (request.user as { role: string }).role;
      if (role !== 'student') return reply.status(403).send({ error: 'Forbidden' });
      const sem = await prisma.semester.findFirst({ where: { isActive: true } });
      if (!sem) return { courses: [] };
      const cr = await prisma.crAssignment.findFirst({
        where: { userId, semesterId: sem.id, isActive: true },
      });
      if (!cr) return reply.status(403).send({ error: 'Not a class rep' });

      const courses = await prisma.course.findMany({
        where: {
          semesterId: sem.id,
          department: cr.department,
          year: cr.year,
          classSection: cr.classSection,
        },
        orderBy: { courseName: 'asc' },
      });
      return {
        courses: courses.map((c) => ({ id: c.id, course_name: c.courseName })),
      };
    }
  );
};
