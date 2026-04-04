import { AlertSubscriptionStatus, BookingStatus, EventType, RoomType } from '@prisma/client';
import { prisma } from './prisma.js';
import type { AiUserContext } from './aiContext.js';
import { ADVANCE_REMINDER_HOURS, CUTOFF_MINUTES_DEFAULT } from './bookingNotifications.js';
import { getRoomUiState } from './roomLifecycle.js';

export type { AiUserContext } from './aiContext.js';

/** Mirrors server/src/routes/bookings.ts — keep in sync for assistant answers. */
const ALL_EVENT_TYPES = ['lecture', 'exam', 'tutor', 'defense', 'lab', 'presentation'] as const;
const TEACHER_EVENT_TYPES = ['lecture', 'tutor', 'exam', 'lab', 'presentation'] as const;
const CR_EVENT_TYPES = ['lecture', 'presentation', 'lab'] as const;

function jsonResult(data: unknown): string {
  return JSON.stringify(data);
}

export type AssistantProposalPayload =
  | {
      kind: 'create_booking';
      room_id: string;
      course_offering_id: string;
      start_time: string;
      end_time: string;
      event_type?: EventType;
      next_booking_preference?: boolean;
    }
  | {
      kind: 'cancel_booking';
      booking_id: string;
    }
  | {
      kind: 'mark_notifications_read';
      mode: 'all' | 'ids';
      notification_ids?: string[];
    }
  | {
      kind: 'room_alert_subscribe';
      room_id: string;
      notify_before_minutes?: number;
    }
  | {
      kind: 'room_alert_cancel';
      subscription_id: string;
    };

export type AssistantProposalResult = {
  proposal_id: string;
  action: AssistantProposalPayload['kind'];
  summary: string;
  expires_at: string;
};

const PROPOSAL_TTL_MS = 10 * 60 * 1000;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

function parseIsoDateTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function roomLabel(buildingName: string, roomNumber: string): string {
  return `${buildingName} ${roomNumber}`.trim();
}

async function createAssistantProposal(
  userId: string,
  action: AssistantProposalPayload['kind'],
  payload: AssistantProposalPayload,
  summary: string
): Promise<AssistantProposalResult> {
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS);
  const row = await prisma.assistantProposal.create({
    data: {
      userId,
      action,
      payloadJson: JSON.stringify(payload),
      summary,
      expiresAt,
    },
  });
  return {
    proposal_id: row.id,
    action,
    summary,
    expires_at: row.expiresAt.toISOString(),
  };
}

export async function getAssistantProposalForUser(proposalId: string, userId: string) {
  const row = await prisma.assistantProposal.findFirst({ where: { id: proposalId, userId } });
  if (!row) return null;
  return row;
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
      name: 'list_my_bookings_filtered',
      description:
        'Role-scoped booking list with optional filters: from, to, status(booked/cancelled), and course_offering_id. Use for time-window questions such as "this week".',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'ISO datetime (inclusive)' },
          to: { type: 'string', description: 'ISO datetime (inclusive)' },
          status: { type: 'string', description: 'booked or cancelled' },
          course_offering_id: { type: 'string' },
          limit: { type: 'integer', description: 'Default 40, max 120' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_offering_bookings',
      description:
        'Bookings for one course offering, role-scoped. Arguments: offering_id and optional from/to ISO datetimes.',
      parameters: {
        type: 'object',
        properties: {
          offering_id: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
        },
        required: ['offering_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_buildings_by_name',
      description: 'Search active buildings by name substring. Use before listing rooms in a building.',
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
      name: 'list_rooms_for_building',
      description:
        'List rooms for a building id with room status (green/yellow/red) and amenities. Use for "what is free in building X".',
      parameters: {
        type: 'object',
        properties: { building_id: { type: 'string' } },
        required: ['building_id'],
        additionalProperties: false,
      },
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
      name: 'search_rooms_advanced',
      description:
        'Search rooms with advanced filters. Supports query (room/building text), building_id, min_capacity, room_type, has_projector, has_internet, has_power.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          building_id: { type: 'string' },
          min_capacity: { type: 'integer' },
          room_type: { type: 'string' },
          has_projector: { type: 'boolean' },
          has_internet: { type: 'boolean' },
          has_power: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_room_availability',
      description:
        'Check if a room is free for a specific time window. Requires room_id, start_time, end_time as ISO datetimes; returns conflicts if any.',
      parameters: {
        type: 'object',
        properties: {
          room_id: { type: 'string' },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
        },
        required: ['room_id', 'start_time', 'end_time'],
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
      name: 'propose_create_booking',
      description:
        'Create a confirmation proposal to book a room. Requires room_id, course_offering_id, start_time, end_time. Returns proposal_id to confirm later.',
      parameters: {
        type: 'object',
        properties: {
          room_id: { type: 'string' },
          course_offering_id: { type: 'string' },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
          event_type: { type: 'string' },
          next_booking_preference: { type: 'boolean' },
        },
        required: ['room_id', 'course_offering_id', 'start_time', 'end_time'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_cancel_booking',
      description: 'Create a confirmation proposal to cancel a booking by booking_id.',
      parameters: {
        type: 'object',
        properties: { booking_id: { type: 'string' } },
        required: ['booking_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_mark_notifications_read',
      description:
        'Create confirmation proposal to mark notifications as read. mode: "all" or "ids". Provide notification_ids when mode is ids.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string' },
          notification_ids: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_room_alert_subscribe',
      description: 'Create confirmation proposal to subscribe to room alerts by room_id.',
      parameters: {
        type: 'object',
        properties: {
          room_id: { type: 'string' },
          notify_before_minutes: { type: 'integer' },
        },
        required: ['room_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_room_alert_cancel',
      description: 'Create confirmation proposal to cancel an active room alert subscription.',
      parameters: {
        type: 'object',
        properties: { subscription_id: { type: 'string' } },
        required: ['subscription_id'],
        additionalProperties: false,
      },
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

async function listMyBookingsFiltered(
  ctx: AiUserContext,
  args: Record<string, unknown>
): Promise<ReturnType<typeof mapBookingRow>[]> {
  const limit = clampInt(args.limit, 40, 1, 120);
  const from = parseIsoDateTime(args.from);
  const to = parseIsoDateTime(args.to);
  const statusArg = typeof args.status === 'string' ? args.status : undefined;
  const status =
    statusArg === 'booked' || statusArg === 'cancelled' ? (statusArg as BookingStatus) : undefined;
  const offeringId = typeof args.course_offering_id === 'string' ? args.course_offering_id.trim() : '';

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

  const commonFilters = {
    ...(status ? { status } : {}),
    ...(from || to
      ? {
          startTime: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(offeringId ? { courseOfferingId: offeringId } : {}),
  };

  if (ctx.role === 'admin') {
    const list = await prisma.booking.findMany({
      where: commonFilters,
      orderBy: { startTime: 'asc' },
      include,
      take: limit,
    });
    return list.map((b) => mapBookingRow(b as BookingWithIncludes, ctx));
  }

  if (ctx.role === 'teacher') {
    const list = await prisma.booking.findMany({
      where: {
        ...commonFilters,
        courseOffering: { teacherUserId: ctx.userId },
      },
      orderBy: { startTime: 'asc' },
      include,
      take: limit,
    });
    return list.map((b) => mapBookingRow(b as BookingWithIncludes, ctx));
  }

  const ay = await prisma.academicYear.findFirst({ where: { isActive: true } });
  if (!ay) return [];
  const cr = await prisma.crAssignment.findFirst({
    where: { userId: ctx.userId, academicYearId: ay.id, isActive: true },
  });
  const list = await prisma.booking.findMany({
    where: {
      ...commonFilters,
      OR: [
        { bookedByUserId: ctx.userId },
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
    take: limit,
  });
  return list.map((b) => mapBookingRow(b as BookingWithIncludes, ctx));
}

async function getOfferingBookings(ctx: AiUserContext, args: Record<string, unknown>) {
  const offeringId = typeof args.offering_id === 'string' ? args.offering_id.trim() : '';
  if (!offeringId) return { error: 'offering_id required' };
  const from = parseIsoDateTime(args.from);
  const to = parseIsoDateTime(args.to);

  const offering = await prisma.courseOffering.findFirst({
    where: { id: offeringId, isActive: true },
    include: { course: true, department: true },
  });
  if (!offering) return { error: 'Course offering not found' };

  if (ctx.role === 'teacher' && offering.teacherUserId !== ctx.userId) {
    return { error: 'Forbidden for this offering' };
  }
  if (ctx.role === 'student') {
    const cr = await prisma.crAssignment.findFirst({
      where: { userId: ctx.userId, academicYearId: offering.academicYearId, isActive: true },
    });
    if (
      !cr ||
      cr.departmentId !== offering.departmentId ||
      cr.year !== offering.year ||
      cr.section !== offering.section
    ) {
      return { error: 'Forbidden for this offering' };
    }
  }

  const list = await prisma.booking.findMany({
    where: {
      courseOfferingId: offeringId,
      ...(from || to
        ? {
            startTime: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { startTime: 'asc' },
    include: {
      room: { include: { building: { select: { name: true } } } },
      bookedBy: { select: { name: true, studentId: true } },
    },
    take: 200,
  });

  return {
    offering: {
      id: offering.id,
      course_name: offering.course.courseName,
      department: offering.department.name,
      year: offering.year,
      class_section: offering.section ?? '',
    },
    bookings: list.map((b) => ({
      id: b.id,
      room: roomLabel(b.room.building.name, b.room.roomNumber),
      start_time: b.startTime.toISOString(),
      end_time: b.endTime.toISOString(),
      status: b.status,
      event_type: b.eventType,
      booked_by: b.bookedBy.name,
      booked_by_student_id: b.bookedBy.studentId,
    })),
  };
}

async function searchBuildingsByName(args: Record<string, unknown>) {
  const q = typeof args.query === 'string' ? args.query.trim() : '';
  if (!q) return { error: 'query required' };
  const rows = await prisma.building.findMany({
    where: { isActive: true, name: { contains: q, mode: 'insensitive' } },
    orderBy: { name: 'asc' },
    take: 30,
  });
  return { buildings: rows.map((b) => ({ id: b.id, name: b.name, floor_count: b.floorCount })) };
}

async function listRoomsForBuilding(args: Record<string, unknown>) {
  const buildingId = typeof args.building_id === 'string' ? args.building_id.trim() : '';
  if (!buildingId) return { error: 'building_id required' };
  const building = await prisma.building.findFirst({ where: { id: buildingId, isActive: true } });
  if (!building) return { error: 'Building not found' };
  const rooms = await prisma.room.findMany({
    where: { buildingId, isActive: true },
    orderBy: [{ floorIndex: 'asc' }, { roomNumber: 'asc' }],
  });
  const roomIds = rooms.map((r) => r.id);
  const bookings =
    roomIds.length === 0
      ? []
      : await prisma.booking.findMany({
          where: { roomId: { in: roomIds }, status: BookingStatus.booked },
          select: { roomId: true, startTime: true, endTime: true, status: true },
        });
  const byRoom = new Map<string, { start_time: Date; end_time: Date; status: BookingStatus }[]>();
  for (const b of bookings) {
    const list = byRoom.get(b.roomId) ?? [];
    list.push({ start_time: b.startTime, end_time: b.endTime, status: b.status });
    byRoom.set(b.roomId, list);
  }
  const now = new Date();
  return {
    building: { id: building.id, name: building.name, floor_count: building.floorCount },
    rooms: rooms.map((r) => ({
      id: r.id,
      room_number: r.roomNumber,
      floor: r.floorIndex,
      capacity: r.capacity,
      room_type: r.roomType,
      has_projector: r.hasProjector,
      has_internet: r.hasInternet,
      has_power: r.hasPower,
      status: getRoomUiState(now, byRoom.get(r.id) ?? []),
    })),
  };
}

async function checkRoomAvailability(args: Record<string, unknown>) {
  const roomId = typeof args.room_id === 'string' ? args.room_id.trim() : '';
  const start = parseIsoDateTime(args.start_time);
  const end = parseIsoDateTime(args.end_time);
  if (!roomId) return { error: 'room_id required' };
  if (!start || !end) return { error: 'start_time and end_time must be ISO datetime strings' };
  if (end <= start) return { error: 'end_time must be after start_time' };
  const room = await prisma.room.findFirst({
    where: { id: roomId, isActive: true },
    include: { building: true },
  });
  if (!room) return { error: 'Room not found' };
  const clashes = await prisma.booking.findMany({
    where: {
      roomId,
      status: BookingStatus.booked,
      AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
    },
    orderBy: { startTime: 'asc' },
    include: {
      courseOffering: { include: { course: { select: { courseName: true } } } },
    },
    take: 25,
  });
  return {
    room: { id: room.id, label: roomLabel(room.building.name, room.roomNumber) },
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    is_available: clashes.length === 0,
    conflicts: clashes.map((b) => ({
      booking_id: b.id,
      start_time: b.startTime.toISOString(),
      end_time: b.endTime.toISOString(),
      event_type: b.eventType,
      course_name: b.courseOffering.course.courseName,
    })),
  };
}

async function searchRoomsAdvanced(args: Record<string, unknown>) {
  const q = typeof args.query === 'string' ? args.query.trim() : '';
  const buildingId = typeof args.building_id === 'string' ? args.building_id.trim() : '';
  const minCapacity = typeof args.min_capacity === 'number' ? Math.max(1, Math.trunc(args.min_capacity)) : undefined;
  const roomType = typeof args.room_type === 'string' && (Object.values(RoomType) as string[]).includes(args.room_type)
    ? (args.room_type as RoomType)
    : undefined;
  const hasProjector = typeof args.has_projector === 'boolean' ? args.has_projector : undefined;
  const hasInternet = typeof args.has_internet === 'boolean' ? args.has_internet : undefined;
  const hasPower = typeof args.has_power === 'boolean' ? args.has_power : undefined;

  const rooms = await prisma.room.findMany({
    where: {
      isActive: true,
      ...(buildingId ? { buildingId } : {}),
      ...(q
        ? {
            OR: [
              { roomNumber: { contains: q, mode: 'insensitive' } },
              { building: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(minCapacity ? { capacity: { gte: minCapacity } } : {}),
      ...(roomType ? { roomType } : {}),
      ...(hasProjector !== undefined ? { hasProjector } : {}),
      ...(hasInternet !== undefined ? { hasInternet } : {}),
      ...(hasPower !== undefined ? { hasPower } : {}),
    },
    include: { building: true },
    orderBy: [{ building: { name: 'asc' } }, { floorIndex: 'asc' }, { roomNumber: 'asc' }],
    take: 80,
  });
  const roomIds = rooms.map((r) => r.id);
  const bookings =
    roomIds.length === 0
      ? []
      : await prisma.booking.findMany({
          where: { roomId: { in: roomIds }, status: BookingStatus.booked },
          select: { roomId: true, startTime: true, endTime: true, status: true },
        });
  const byRoom = new Map<string, { start_time: Date; end_time: Date; status: BookingStatus }[]>();
  for (const b of bookings) {
    const list = byRoom.get(b.roomId) ?? [];
    list.push({ start_time: b.startTime, end_time: b.endTime, status: b.status });
    byRoom.set(b.roomId, list);
  }
  const now = new Date();
  return {
    rooms: rooms.map((r) => ({
      id: r.id,
      room_number: r.roomNumber,
      building_id: r.buildingId,
      building_name: r.building.name,
      floor: r.floorIndex,
      capacity: r.capacity,
      room_type: r.roomType,
      has_projector: r.hasProjector,
      has_internet: r.hasInternet,
      has_power: r.hasPower,
      status: getRoomUiState(now, byRoom.get(r.id) ?? []),
    })),
  };
}

async function proposeCreateBooking(ctx: AiUserContext, args: Record<string, unknown>) {
  const roomId = typeof args.room_id === 'string' ? args.room_id.trim() : '';
  const offeringId = typeof args.course_offering_id === 'string' ? args.course_offering_id.trim() : '';
  const start = parseIsoDateTime(args.start_time);
  const end = parseIsoDateTime(args.end_time);
  const eventTypeStr =
    typeof args.event_type === 'string' && (ALL_EVENT_TYPES as readonly string[]).includes(args.event_type)
      ? args.event_type
      : EventType.lecture;
  const eventType = eventTypeStr as EventType;
  const nextPreference = typeof args.next_booking_preference === 'boolean' ? args.next_booking_preference : false;
  if (!roomId || !offeringId || !start || !end) {
    return { error: 'room_id, course_offering_id, start_time, end_time required' };
  }
  if (end <= start) return { error: 'end_time must be after start_time' };

  const [room, offering] = await Promise.all([
    prisma.room.findFirst({ where: { id: roomId, isActive: true }, include: { building: true } }),
    prisma.courseOffering.findFirst({ where: { id: offeringId, isActive: true }, include: { academicYear: true, course: true } }),
  ]);
  if (!room) return { error: 'Room not found' };
  if (!offering) return { error: 'Course offering not found' };
  if (!offering.academicYear.isActive) return { error: 'Academic year is not active' };

  if (ctx.role === 'teacher') {
    if (!offering.teacherUserId || offering.teacherUserId !== ctx.userId) {
      return { error: 'Not assigned to this course offering' };
    }
    if (!(TEACHER_EVENT_TYPES as readonly string[]).includes(eventTypeStr)) {
      return { error: `Teachers cannot create "${eventType}" events.` };
    }
  } else if (ctx.role === 'student') {
    const cr = await prisma.crAssignment.findFirst({
      where: {
        userId: ctx.userId,
        academicYearId: offering.academicYearId,
        isActive: true,
        departmentId: offering.departmentId,
        year: offering.year,
        section: offering.section,
      },
    });
    if (!cr) return { error: 'CR scope required' };
    if (!(CR_EVENT_TYPES as readonly string[]).includes(eventTypeStr)) {
      return { error: `Class reps cannot create "${eventType}" events.` };
    }
  } else if (ctx.role !== 'admin') {
    return { error: 'Forbidden' };
  }

  const clash = await prisma.booking.findFirst({
    where: {
      roomId,
      status: BookingStatus.booked,
      AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
    },
  });
  if (clash) return { error: 'Time slot overlaps an existing booking' };

  const payload: AssistantProposalPayload = {
    kind: 'create_booking',
    room_id: roomId,
    course_offering_id: offeringId,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    event_type: eventType,
    next_booking_preference: nextPreference,
  };
  return createAssistantProposal(
    ctx.userId,
    'create_booking',
    payload,
    `Create ${eventType} booking for ${offering.course.courseName} in ${roomLabel(room.building.name, room.roomNumber)} from ${start.toISOString()} to ${end.toISOString()}`
  );
}

async function proposeCancelBooking(ctx: AiUserContext, args: Record<string, unknown>) {
  const bookingId = typeof args.booking_id === 'string' ? args.booking_id.trim() : '';
  if (!bookingId) return { error: 'booking_id required' };
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { courseOffering: true, room: { include: { building: true } } },
  });
  if (!booking) return { error: 'Booking not found' };
  if (booking.status !== BookingStatus.booked) return { error: 'Booking is already cancelled' };

  if (ctx.role === 'teacher') {
    if (booking.courseOffering.teacherUserId !== ctx.userId) return { error: 'Forbidden for this booking' };
  } else if (ctx.role === 'student') {
    const canOwn = booking.bookedByUserId === ctx.userId;
    if (!canOwn) return { error: 'Students can only cancel their own bookings' };
  } else if (ctx.role !== 'admin') {
    return { error: 'Forbidden' };
  }

  const payload: AssistantProposalPayload = { kind: 'cancel_booking', booking_id: bookingId };
  return createAssistantProposal(
    ctx.userId,
    'cancel_booking',
    payload,
    `Cancel booking in ${roomLabel(booking.room.building.name, booking.room.roomNumber)} starting ${booking.startTime.toISOString()}`
  );
}

async function proposeMarkNotificationsRead(ctx: AiUserContext, args: Record<string, unknown>) {
  const mode = args.mode === 'ids' ? 'ids' : 'all';
  const ids =
    mode === 'ids' && Array.isArray(args.notification_ids)
      ? args.notification_ids.filter((x): x is string => typeof x === 'string').slice(0, 100)
      : undefined;
  if (mode === 'ids' && (!ids || ids.length === 0)) return { error: 'notification_ids required when mode=ids' };
  const payload: AssistantProposalPayload =
    mode === 'ids'
      ? { kind: 'mark_notifications_read', mode: 'ids', notification_ids: ids }
      : { kind: 'mark_notifications_read', mode: 'all' };
  return createAssistantProposal(
    ctx.userId,
    'mark_notifications_read',
    payload,
    mode === 'all' ? 'Mark all unread notifications as read' : `Mark ${ids?.length ?? 0} notifications as read`
  );
}

async function proposeRoomAlertSubscribe(ctx: AiUserContext, args: Record<string, unknown>) {
  const roomId = typeof args.room_id === 'string' ? args.room_id.trim() : '';
  if (!roomId) return { error: 'room_id required' };
  const room = await prisma.room.findFirst({ where: { id: roomId, isActive: true }, include: { building: true } });
  if (!room) return { error: 'Room not found' };
  const notifyBefore = clampInt(args.notify_before_minutes, 10, 1, 120);
  const payload: AssistantProposalPayload = {
    kind: 'room_alert_subscribe',
    room_id: roomId,
    notify_before_minutes: notifyBefore,
  };
  return createAssistantProposal(
    ctx.userId,
    'room_alert_subscribe',
    payload,
    `Subscribe to room alert for ${roomLabel(room.building.name, room.roomNumber)} (${notifyBefore} min before)`
  );
}

async function proposeRoomAlertCancel(ctx: AiUserContext, args: Record<string, unknown>) {
  const subId = typeof args.subscription_id === 'string' ? args.subscription_id.trim() : '';
  if (!subId) return { error: 'subscription_id required' };
  const row = await prisma.roomAlertSubscription.findFirst({
    where: { id: subId, userId: ctx.userId },
    include: { room: { include: { building: true } } },
  });
  if (!row) return { error: 'Subscription not found' };
  if (row.status !== AlertSubscriptionStatus.active) return { error: 'Subscription is not active' };
  const payload: AssistantProposalPayload = { kind: 'room_alert_cancel', subscription_id: subId };
  return createAssistantProposal(
    ctx.userId,
    'room_alert_cancel',
    payload,
    `Cancel room alert for ${roomLabel(row.room.building.name, row.room.roomNumber)}`
  );
}

export async function confirmAssistantProposal(
  proposalId: string,
  ctx: AiUserContext
): Promise<{ ok: true; action: string; result: unknown } | { ok: false; error: string }> {
  const proposal = await prisma.assistantProposal.findFirst({
    where: { id: proposalId, userId: ctx.userId },
  });
  if (!proposal) return { ok: false, error: 'Proposal not found' };
  if (proposal.status !== 'pending') return { ok: false, error: `Proposal already ${proposal.status}` };
  if (proposal.expiresAt.getTime() <= Date.now()) {
    await prisma.assistantProposal.update({ where: { id: proposal.id }, data: { status: 'expired' } });
    return { ok: false, error: 'Proposal expired' };
  }

  let payload: AssistantProposalPayload;
  try {
    payload = JSON.parse(proposal.payloadJson) as AssistantProposalPayload;
  } catch {
    return { ok: false, error: 'Invalid proposal payload' };
  }

  if (payload.kind === 'create_booking') {
    const start = new Date(payload.start_time);
    const end = new Date(payload.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { ok: false, error: 'Invalid time range in proposal' };
    }
    const clash = await prisma.booking.findFirst({
      where: {
        roomId: payload.room_id,
        status: BookingStatus.booked,
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    });
    if (clash) return { ok: false, error: 'Time slot overlaps an existing booking' };
    const booking = await prisma.booking.create({
      data: {
        roomId: payload.room_id,
        courseOfferingId: payload.course_offering_id,
        bookedByUserId: ctx.userId,
        eventType: payload.event_type ?? EventType.lecture,
        startTime: start,
        endTime: end,
        status: BookingStatus.booked,
        nextBookingPreference: payload.next_booking_preference ?? false,
      },
    });
    await prisma.assistantProposal.update({
      where: { id: proposal.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    return { ok: true, action: payload.kind, result: { booking_id: booking.id } };
  }

  if (payload.kind === 'cancel_booking') {
    const row = await prisma.booking.findUnique({ where: { id: payload.booking_id } });
    if (!row) return { ok: false, error: 'Booking not found' };
    if (row.status !== BookingStatus.booked) return { ok: false, error: 'Booking already cancelled' };
    await prisma.booking.update({ where: { id: row.id }, data: { status: BookingStatus.cancelled } });
    await prisma.assistantProposal.update({
      where: { id: proposal.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    return { ok: true, action: payload.kind, result: { booking_id: row.id, status: 'cancelled' } };
  }

  if (payload.kind === 'mark_notifications_read') {
    if (payload.mode === 'all') {
      await prisma.notification.updateMany({
        where: { userId: ctx.userId, isRead: false },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: ctx.userId, id: { in: payload.notification_ids ?? [] } },
        data: { isRead: true },
      });
    }
    await prisma.assistantProposal.update({
      where: { id: proposal.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    return { ok: true, action: payload.kind, result: { mode: payload.mode } };
  }

  if (payload.kind === 'room_alert_subscribe') {
    const room = await prisma.room.findFirst({ where: { id: payload.room_id, isActive: true } });
    if (!room) return { ok: false, error: 'Room not found' };
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await prisma.roomAlertSubscription.updateMany({
      where: { userId: ctx.userId, roomId: payload.room_id, status: AlertSubscriptionStatus.active },
      data: { status: AlertSubscriptionStatus.cancelled },
    });
    const sub = await prisma.roomAlertSubscription.create({
      data: {
        userId: ctx.userId,
        roomId: payload.room_id,
        notifyBeforeMinutes: clampInt(payload.notify_before_minutes, 10, 1, 120),
        expiresAt,
        status: AlertSubscriptionStatus.active,
      },
    });
    await prisma.assistantProposal.update({
      where: { id: proposal.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    return { ok: true, action: payload.kind, result: { subscription_id: sub.id } };
  }

  if (payload.kind === 'room_alert_cancel') {
    const row = await prisma.roomAlertSubscription.findFirst({
      where: { id: payload.subscription_id, userId: ctx.userId },
    });
    if (!row) return { ok: false, error: 'Subscription not found' };
    await prisma.roomAlertSubscription.update({
      where: { id: row.id },
      data: { status: AlertSubscriptionStatus.cancelled },
    });
    await prisma.assistantProposal.update({
      where: { id: proposal.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    return { ok: true, action: payload.kind, result: { subscription_id: row.id, status: 'cancelled' } };
  }

  return { ok: false, error: 'Unsupported proposal action' };
}

export async function cancelAssistantProposal(
  proposalId: string,
  ctx: AiUserContext
): Promise<{ ok: true } | { ok: false; error: string }> {
  const proposal = await prisma.assistantProposal.findFirst({
    where: { id: proposalId, userId: ctx.userId },
  });
  if (!proposal) return { ok: false, error: 'Proposal not found' };
  if (proposal.status !== 'pending') return { ok: false, error: `Proposal already ${proposal.status}` };
  await prisma.assistantProposal.update({
    where: { id: proposal.id },
    data: { status: 'cancelled' },
  });
  return { ok: true };
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
      case 'list_my_bookings_filtered': {
        return jsonResult({ bookings: await listMyBookingsFiltered(ctx, args) });
      }
      case 'get_offering_bookings': {
        return jsonResult(await getOfferingBookings(ctx, args));
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
      case 'search_buildings_by_name': {
        return jsonResult(await searchBuildingsByName(args));
      }
      case 'list_rooms_for_building': {
        return jsonResult(await listRoomsForBuilding(args));
      }
      case 'search_rooms_advanced': {
        return jsonResult(await searchRoomsAdvanced(args));
      }
      case 'check_room_availability': {
        return jsonResult(await checkRoomAvailability(args));
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
      case 'propose_create_booking': {
        return jsonResult(await proposeCreateBooking(ctx, args));
      }
      case 'propose_cancel_booking': {
        return jsonResult(await proposeCancelBooking(ctx, args));
      }
      case 'propose_mark_notifications_read': {
        return jsonResult(await proposeMarkNotificationsRead(ctx, args));
      }
      case 'propose_room_alert_subscribe': {
        return jsonResult(await proposeRoomAlertSubscribe(ctx, args));
      }
      case 'propose_room_alert_cancel': {
        return jsonResult(await proposeRoomAlertCancel(ctx, args));
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
