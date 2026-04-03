import { prisma } from './prisma.js';
import { ADVANCE_REMINDER_HOURS, CUTOFF_MINUTES_DEFAULT } from './bookingNotifications.js';
import type { AiUserContext } from './aiContext.js';

export type SessionBrief = {
  session_brief_version: 1;
  client_context?: { screen?: string; platform?: string };
  user: {
    display_name: string;
    role: string;
    student_id: string;
    faculty: string | null;
    department: string | null;
    year: number | null;
    section: string | null;
  };
  active_academic_year: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  } | null;
  class_rep:
    | null
    | {
        department_id: string;
        department_name: string;
        year: number;
        section: string | null;
      };
  policy: {
    cutoff_minutes_before_class: number;
    advance_reminder_hours: number;
    timezone_display: string;
  };
};

export async function buildSessionBrief(
  ctx: AiUserContext,
  clientContext?: { screen?: string; platform?: string }
): Promise<SessionBrief> {
  const [user, ay] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ctx.userId },
      include: { faculty: true, department: true },
    }),
    prisma.academicYear.findFirst({ where: { isActive: true } }),
  ]);

  const displayName = user?.name ?? 'User';
  const cr =
    ctx.role === 'student' && ay
      ? await prisma.crAssignment.findFirst({
          where: { userId: ctx.userId, academicYearId: ay.id, isActive: true },
          include: { department: { select: { name: true } } },
        })
      : null;

  return {
    session_brief_version: 1,
    ...(clientContext && Object.keys(clientContext).length ? { client_context: clientContext } : {}),
    user: {
      display_name: displayName,
      role: ctx.role,
      student_id: user?.studentId ?? '',
      faculty: user?.faculty?.name ?? null,
      department: user?.department?.name ?? null,
      year: user?.year ?? null,
      section: user?.section ?? null,
    },
    active_academic_year: ay
      ? {
          id: ay.id,
          name: ay.name,
          start_date: ay.startDate.toISOString().slice(0, 10),
          end_date: ay.endDate.toISOString().slice(0, 10),
        }
      : null,
    class_rep: cr
      ? {
          department_id: cr.departmentId,
          department_name: cr.department.name,
          year: cr.year,
          section: cr.section,
        }
      : null,
    policy: {
      cutoff_minutes_before_class: CUTOFF_MINUTES_DEFAULT,
      advance_reminder_hours: ADVANCE_REMINDER_HOURS,
      timezone_display: 'Africa/Addis_Ababa',
    },
  };
}

export function sessionBriefToSystemContent(brief: SessionBrief): string {
  return [
    'Current session snapshot (JSON). Trust these facts; use tools for schedules, lists, and anything not included here.',
    JSON.stringify(brief),
  ].join('\n');
}

/** Layered instructions: domain glossary, role playbooks, tool discipline. */
export function buildCampusAssistantSystemPrompt(): string {
  return [
    'You are the Campus Assistant — a scheduling copilot for lecture rooms, course offerings, and bookings.',
    'Tone: concise, friendly, actionable. Prefer short paragraphs or bullet lists for schedules.',
    '',
    '## Domain glossary',
    '- Catalog course: a reusable course record (name and optional code).',
    '- Course offering: a specific run of a course in an academic year for a department cohort (year level and optional section), optionally assigned to a teacher. Bookings attach to offerings.',
    '- Booking: a reserved room time slot for an offering (event type, start/end).',
    '- Class representative (CR): not a separate login role. A student with an active class-rep assignment for the current academic year may book rooms for their cohort offerings.',
    '',
    '## Data rules',
    '- Use tools for timetables, room search, notifications, and detailed lists. Never invent room numbers, times, or policies.',
    '- If tools return empty data, say so plainly and suggest what the user could do in the app (e.g. open Schedule or Explore).',
    '- Do not mention raw tool names to the user; say what you looked up in natural language.',
    '- Internal UUIDs: only share when the user needs them for admin or support.',
    '',
    '## Policy (also in session JSON)',
    '- Explain cutoff and reminders in plain language using the numbers from the session snapshot.',
    '',
    '## Privacy',
    '- Do not expose other users\' email addresses. Names and student IDs visible through the user\'s own bookings list are fine within that visibility scope.',
    '',
    '## Role playbooks',
    '- Admin: campus-wide bookings, structure, academic years, catalog search, operational questions.',
    '- Teacher: offerings they teach, bookings for those offerings, room amenities for teaching.',
    '- Student: enrolled classes (offerings), personal and cohort-related bookings if they are a CR, policy reminders.',
    '- Class rep (student with class_rep in session): emphasize cohort offerings they can book for and allowed event types from booking rules tool.',
  ].join('\n');
}
