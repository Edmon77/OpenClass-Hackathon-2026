import { BookingStatus } from '@prisma/client';
import { prisma } from './prisma.js';
import type { AiUserContext } from './aiContext.js';
import { ADVANCE_REMINDER_HOURS, CUTOFF_MINUTES_DEFAULT } from './bookingNotifications.js';

export type { AiUserContext } from './aiContext.js';

/** Mirrors server/src/routes/bookings.ts — keep in sync for assistant answers. */
const ALL_EVENT_TYPES = ['lecture', 'exam', 'tutor', 'defense', 'lab', 'presentation'] as const;
const TEACHER_EVENT_TYPES = ['lecture', 'tutor', 'exam', 'lab', 'presentation'] as const;
const CR_EVENT_TYPES = ['lecture', 'presentation', 'lab'] as const;

function jsonResult(data: unknown): string {
  return JSON.stringify(data);
}

const ADMIN_ONLY_TOOLS: {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}[] = [
  {
    type: 'function',
    function: {
      name: 'list_academic_years',
      description:
        'Admin only. List academic years (active flag, date range). Use for term setup or cross-year questions.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'admin_booking_stats',
      description:
        'Admin only. Count bookings in a date range (booked vs cancelled). Example args: {"start_date":"2026-04-01","end_date":"2026-04-07"} (ISO dates, optional — defaults last 7 days).',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'YYYY-MM-DD inclusive' },
          end_date: { type: 'string', description: 'YYYY-MM-DD inclusive' },
        },
        additionalProperties: false,
      },
    },
  },
];

const BASE_TOOLS: {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}[] = [
  {
    type: 'function',
    function: {
      name: 'get_profile',
      description:
        'Full profile for the signed-in user: name, student ID, role, faculty, department, year, section, class-rep cohort (if any), active academic year id. Use when personal context is unclear.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_campus_policy',
      description:
        'Official reminder policy: minutes before class for cutoff warnings, advance reminder hours, display timezone. Use for “what are the rules?” about notifications.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_event_rules',
      description:
        'Which event types teachers vs class reps may use when creating bookings. Use when user asks what they can book.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_bookings',
      description:
        'Bookings visible to this user: admin = campus-wide; teacher = their offerings; student = own + cohort if class rep. Includes booker label, status, room, offering context. Optional limit (default 30, max 100).',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', description: 'Max rows, default 30' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_bookable_courses',
      description:
        'Course offerings the user may book rooms for this academic year (admin: all; teacher: assigned; class rep: cohort only).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_classes',
      description:
        'Students: enrolled offerings (classes) for the active year from department/year/section. Not for teachers/admins.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_rooms',
      description:
        'Find rooms by room number substring (case-insensitive). Example: {"query":"301"}. Returns building, floor, capacity, type, amenities.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_room_details',
      description:
        'One room by UUID (from search_rooms or app). Returns building, amenities, equipment summary, and today’s booked slots in that room.',
      parameters: {
        type: 'object',
        properties: { room_id: { type: 'string', description: 'Room UUID' } },
        required: ['room_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_buildings',
      description: 'All active buildings with floor count. Use for “where is …” navigation.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_catalog_courses',
      description:
        'Search the course catalog by name or code substring. Example: {"query":"calculus"}. Not the same as offerings — catalog templates only.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'integer', description: 'Max 30, default 20' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_notifications',
      description:
        'Recent in-app notifications for this user (titles, read state). Optional limit (default 25, max 50).',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_room_alerts',
      description: 'Room alert subscriptions (notify-before settings, expiry, room label).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'faculty_department_structure',
      description: 'Faculties and their active departments — org hierarchy.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'active_academic_year',
      description: 'Active academic year id and dates if configured.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
];

export function getAiToolDefinitions(ctx: AiUserContext): typeof BASE_TOOLS {
  if (ctx.role === 'admin') return [...BASE_TOOLS, ...ADMIN_ONLY_TOOLS];
  return [...BASE_TOOLS];
}

type BookingWithIncludes = {
  id: string;
  roomId: string;
  courseOfferingId: string;
  bookedByUserId: string;
  eventType: string;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  nextBookingPreference: boolean;
  bookedBy: { id: string; name: string; studentId: string };
  courseOffering: {
    year: number;
    section: string | null;
    course: { courseName: string };
    department: { name: string };
  };
  room: { roomNumber: string; building: { name: string } };
};

function mapBookingRow(b: BookingWithIncludes, ctx: AiUserContext) {
  const isSelf = b.bookedByUserId === ctx.userId;
  let booked_by_label: string;
  let booked_by_student_id: string | undefined;
  if (ctx.role === 'student') {
    booked_by_label = isSelf ? 'You' : b.bookedBy.name;
    if (!isSelf) booked_by_student_id = b.bookedBy.studentId;
  } else {
    booked_by_label = b.bookedBy.name;
    booked_by_student_id = b.bookedBy.studentId;
  }

  return {
    id: b.id,
    building: b.room.building.name,
    room_number: b.room.roomNumber,
    course: b.courseOffering.course.courseName,
    course_offering: {
      department: b.courseOffering.department.name,
      year: b.courseOffering.year,
      class_section: b.courseOffering.section ?? '',
    },
    start_time: b.startTime.toISOString(),
    end_time: b.endTime.toISOString(),
    event_type: b.eventType,
    status: b.status,
    next_booking_preference: b.nextBookingPreference,
    booked_by_label,
    ...(booked_by_student_id ? { booked_by_student_id } : {}),
  };
}

async function listMyBookings(ctx: AiUserContext, limit: number): Promise<ReturnType<typeof mapBookingRow>[]> {
  const cap = Math.min(Math.max(limit || 30, 1), 100);
  const { userId, role } = ctx;

  const include = {
    bookedBy: { select: { id: true, name: true, studentId: true } },
    courseOffering: {
      include: {
        course: { select: { courseName: true } },
        department: { select: { name: true } },
      },
    },
    room: { include: { building: { select: { name: true } } } },
  };

  if (role === 'admin') {
    const list = await prisma.booking.findMany({
      where: { status: BookingStatus.booked },
      orderBy: { startTime: 'asc' },
      include,
      take: cap,
    });
    return list.map((b) => mapBookingRow(b as BookingWithIncludes, ctx));
  }

  if (role === 'teacher') {
    const list = await prisma.booking.findMany({
      where: { status: BookingStatus.booked, courseOffering: { teacherUserId: userId } },
      orderBy: { startTime: 'asc' },
      include,
      take: cap,
    });
    return list.map((b) => mapBookingRow(b as BookingWithIncludes, ctx));
  }

  if (role === 'student') {
    const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!ay) return [];

    const cr = await prisma.crAssignment.findFirst({
      where: { userId, academicYearId: ay.id, isActive: true },
    });

    const list = await prisma.booking.findMany({
      where: {
        status: BookingStatus.booked,
        OR: [
          { bookedByUserId: userId },
          ...(cr
            ? [
                {
                  courseOffering: {
                    academicYearId: ay.id,
                    departmentId: cr.departmentId,
                    year: cr.year,
                    section: cr.section,
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: { startTime: 'asc' },
      include,
      take: cap,
    });
    return list.map((b) => mapBookingRow(b as BookingWithIncludes, ctx));
  }

  return [];
}

async function listBookableCourses(ctx: AiUserContext) {
  const { userId, role } = ctx;
  const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
  if (!ay) return { academic_year: null, courses: [] };

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
      take: 200,
    });
    return { academic_year: ay.name, courses: offerings.map(mapOffering) };
  }

  if (role === 'teacher') {
    const offerings = await prisma.courseOffering.findMany({
      where: { academicYearId: ay.id, isActive: true, teacherUserId: userId },
      include: { course: true, department: true },
      orderBy: { course: { courseName: 'asc' } },
      take: 200,
    });
    return { academic_year: ay.name, courses: offerings.map(mapOffering) };
  }

  if (role === 'student') {
    const cr = await prisma.crAssignment.findFirst({
      where: { userId, academicYearId: ay.id, isActive: true },
    });
    if (!cr) return { academic_year: ay.name, courses: [] };
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
      take: 200,
    });
    return { academic_year: ay.name, courses: offerings.map(mapOffering) };
  }

  return { academic_year: ay.name, courses: [] };
}

export async function executeAiTool(
  name: string,
  argsJson: string,
  ctx: AiUserContext
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    const parsed = argsJson?.trim() ? JSON.parse(argsJson) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
  } catch {
    return jsonResult({ error: 'Invalid JSON arguments' });
  }

  try {
    switch (name) {
      case 'get_profile': {
        const u = await prisma.user.findUnique({
          where: { id: ctx.userId },
          include: { faculty: true, department: true },
        });
        if (!u) return jsonResult({ error: 'User not found' });
        const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
        const cr =
          ay && ctx.role === 'student'
            ? await prisma.crAssignment.findFirst({
                where: { userId: ctx.userId, academicYearId: ay.id, isActive: true },
                include: { department: { select: { name: true } } },
              })
            : null;
        return jsonResult({
          name: u.name,
          student_id: u.studentId,
          role: u.role,
          email: u.email,
          faculty: u.faculty?.name ?? null,
          department: u.department?.name ?? null,
          year: u.year,
          section: u.section,
          program: u.program,
          active_academic_year_id: ay?.id ?? null,
          class_rep: cr
            ? {
                department_name: cr.department.name,
                year: cr.year,
                section: cr.section,
              }
            : null,
        });
      }
      case 'get_campus_policy': {
        return jsonResult({
          cutoff_minutes_before_class: CUTOFF_MINUTES_DEFAULT,
          advance_reminder_hours: ADVANCE_REMINDER_HOURS,
          timezone_display: 'Africa/Addis_Ababa',
        });
      }
      case 'get_booking_event_rules': {
        return jsonResult({
          all_event_types: [...ALL_EVENT_TYPES],
          teacher_may_use: [...TEACHER_EVENT_TYPES],
          class_rep_may_use: [...CR_EVENT_TYPES],
          note: 'Class reps are students with an active class-rep assignment for the active academic year.',
        });
      }
      case 'list_my_bookings': {
        const limit = typeof args.limit === 'number' ? args.limit : 30;
        const bookings = await listMyBookings(ctx, limit);
        return jsonResult({ bookings });
      }
      case 'list_bookable_courses': {
        return jsonResult(await listBookableCourses(ctx));
      }
      case 'list_my_classes': {
        if (ctx.role !== 'student') {
          return jsonResult({ message: 'Only students have a class list in this app.' });
        }
        const userId = ctx.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user?.departmentId || user.year == null) {
          return jsonResult({ courses: [] });
        }
        const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
        if (!ay) return jsonResult({ courses: [] });

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
          take: 100,
        });

        return jsonResult({
          courses: offerings.map((o) => ({
            id: o.id,
            course_name: o.course.courseName,
            course_code: o.course.courseCode,
            teacher_name: o.teacher?.name ?? null,
            department: o.department.name,
            year: o.year,
            class_section: o.section ?? '',
          })),
        });
      }
      case 'search_rooms': {
        const q = String(args.query ?? '').trim();
        if (q.length < 1) return jsonResult({ error: 'query required' });
        if (q.length > 64) return jsonResult({ error: 'query too long' });
        const rooms = await prisma.room.findMany({
          where: { isActive: true, roomNumber: { contains: q, mode: 'insensitive' } },
          include: { building: true },
          take: 40,
          orderBy: [{ building: { name: 'asc' } }, { floorIndex: 'asc' }, { roomNumber: 'asc' }],
        });
        return jsonResult({
          rooms: rooms.map((r) => ({
            id: r.id,
            room_number: r.roomNumber,
            building: r.building.name,
            floor: r.floorIndex,
            capacity: r.capacity,
            room_type: r.roomType,
            has_projector: r.hasProjector,
            has_internet: r.hasInternet,
            has_power: r.hasPower,
          })),
        });
      }
      case 'get_room_details': {
        const roomId = String(args.room_id ?? '').trim();
        if (!roomId) return jsonResult({ error: 'room_id required' });
        const room = await prisma.room.findFirst({
          where: { id: roomId, isActive: true },
          include: { building: true },
        });
        if (!room) return jsonResult({ error: 'Room not found' });

        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);

        const todayBookings = await prisma.booking.findMany({
          where: {
            roomId,
            status: BookingStatus.booked,
            startTime: { gte: start, lt: end },
          },
          orderBy: { startTime: 'asc' },
          include: { courseOffering: { include: { course: { select: { courseName: true } } } } },
          take: 50,
        });

        let equipment: unknown = null;
        if (room.equipmentJson) {
          try {
            equipment = JSON.parse(room.equipmentJson) as unknown;
          } catch {
            equipment = room.equipmentJson;
          }
        }

        return jsonResult({
          id: room.id,
          room_number: room.roomNumber,
          building: room.building.name,
          floor: room.floorIndex,
          capacity: room.capacity,
          room_type: room.roomType,
          has_projector: room.hasProjector,
          has_internet: room.hasInternet,
          has_power: room.hasPower,
          equipment,
          todays_bookings: todayBookings.map((b) => ({
            start_time: b.startTime.toISOString(),
            end_time: b.endTime.toISOString(),
            event_type: b.eventType,
            course: b.courseOffering.course.courseName,
          })),
        });
      }
      case 'list_buildings': {
        const rows = await prisma.building.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        });
        return jsonResult({
          buildings: rows.map((b) => ({ id: b.id, name: b.name, floor_count: b.floorCount })),
        });
      }
      case 'search_catalog_courses': {
        const q = String(args.query ?? '').trim();
        if (q.length < 1) return jsonResult({ error: 'query required' });
        if (q.length > 120) return jsonResult({ error: 'query too long' });
        const lim = Math.min(typeof args.limit === 'number' ? args.limit : 20, 30);
        const courses = await prisma.course.findMany({
          where: {
            isActive: true,
            OR: [
              { courseName: { contains: q, mode: 'insensitive' } },
              { courseCode: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: lim,
          orderBy: { courseName: 'asc' },
        });
        return jsonResult({
          courses: courses.map((c) => ({
            id: c.id,
            course_name: c.courseName,
            course_code: c.courseCode,
          })),
        });
      }
      case 'list_my_notifications': {
        const lim = Math.min(Math.max(typeof args.limit === 'number' ? args.limit : 25, 1), 50);
        const rows = await prisma.notification.findMany({
          where: { userId: ctx.userId },
          orderBy: { createdAt: 'desc' },
          take: lim,
        });
        return jsonResult({
          notifications: rows.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            is_read: n.isRead,
            created_at: n.createdAt.toISOString(),
          })),
        });
      }
      case 'list_my_room_alerts': {
        const rows = await prisma.roomAlertSubscription.findMany({
          where: { userId: ctx.userId },
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: { room: { include: { building: { select: { name: true } } } } },
        });
        return jsonResult({
          alerts: rows.map((a) => ({
            id: a.id,
            status: a.status,
            notify_before_minutes: a.notifyBeforeMinutes,
            expires_at: a.expiresAt.toISOString(),
            room: `${a.room.building.name} ${a.room.roomNumber}`,
          })),
        });
      }
      case 'faculty_department_structure': {
        const faculties = await prisma.faculty.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            departments: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              select: { id: true, name: true },
            },
          },
        });
        return jsonResult({
          faculties: faculties.map((f) => ({
            id: f.id,
            name: f.name,
            departments: f.departments.map((d) => ({ id: d.id, name: d.name })),
          })),
        });
      }
      case 'active_academic_year': {
        const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
        if (!ay) return jsonResult({ active: null });
        return jsonResult({
          id: ay.id,
          name: ay.name,
          start_date: ay.startDate.toISOString().slice(0, 10),
          end_date: ay.endDate.toISOString().slice(0, 10),
        });
      }
      case 'list_academic_years': {
        if (ctx.role !== 'admin') return jsonResult({ error: 'Admin only' });
        const years = await prisma.academicYear.findMany({
          orderBy: { startDate: 'desc' },
          take: 24,
        });
        return jsonResult({
          academic_years: years.map((y) => ({
            id: y.id,
            name: y.name,
            start_date: y.startDate.toISOString().slice(0, 10),
            end_date: y.endDate.toISOString().slice(0, 10),
            is_active: y.isActive,
          })),
        });
      }
      case 'admin_booking_stats': {
        if (ctx.role !== 'admin') return jsonResult({ error: 'Admin only' });
        const end = new Date();
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 7);
        let rangeStart = start;
        let rangeEnd = end;
        if (typeof args.start_date === 'string' && typeof args.end_date === 'string') {
          const s = new Date(`${args.start_date}T00:00:00.000Z`);
          const e = new Date(`${args.end_date}T23:59:59.999Z`);
          if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s) {
            rangeStart = s;
            rangeEnd = e;
          }
        }
        const [booked, cancelled] = await Promise.all([
          prisma.booking.count({
            where: {
              status: BookingStatus.booked,
              startTime: { gte: rangeStart, lte: rangeEnd },
            },
          }),
          prisma.booking.count({
            where: {
              status: BookingStatus.cancelled,
              startTime: { gte: rangeStart, lte: rangeEnd },
            },
          }),
        ]);
        return jsonResult({
          period: {
            start: rangeStart.toISOString().slice(0, 10),
            end: rangeEnd.toISOString().slice(0, 10),
          },
          booked_count: booked,
          cancelled_count: cancelled,
        });
      }
      default:
        return jsonResult({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Tool error';
    return jsonResult({ error: message });
  }
}
