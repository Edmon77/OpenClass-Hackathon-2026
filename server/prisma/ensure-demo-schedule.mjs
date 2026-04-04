/**
 * Schedule demo: faculties, teachers, CRs, courses, offerings, bookings (no tsx).
 * Depends on rooms from ensure-demo-campus.mjs. Idempotent upserts; refreshes booking times from "today".
 */
import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = dirname(here);
config({ path: join(serverDir, '..', '.env') });
config({ path: join(serverDir, '.env'), override: true });

if (!process.env.DATABASE_URL?.trim() && process.env.POSTGRES_PASSWORD) {
  const user = process.env.POSTGRES_USER ?? 'postgres';
  const db = process.env.POSTGRES_DB ?? 'lecture_room';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  process.env.DATABASE_URL = `postgresql://${user}:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@${host}:${port}/${db}`;
}

const AY_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_PASSWORD = 'Hackathon2026';

const FACULTY_DEPTS = {
  'Bahir Dar Energy Center': ['Sustainable Energy Engineering'],
  'BiT SANS and Pre-Engineering': ['BiT SANS and Pre-Engineering'],
  'Faculty of Chemical and Food Engineering': [
    'Applied Human Nutrition',
    'Chemical Engineering',
    'Food Technology and Process Engineering',
  ],
  'Faculty of Civil and Water Resources Engineering': [
    'Civil Engineering',
    'Hydraulic and Water Resource Engineering',
    'Water Resource Engineering',
    'Water Resources and Environmental Engineering',
    'Water Resources and Irrigation Engineering',
  ],
  'Faculty of Computing': [
    'Artificial Intelligence and Data Science',
    'Computer Science',
    'Cyber Security',
    'Information Systems',
    'Information Technology',
    'Pre-Fresh(Computing)',
    'Software Engineering',
  ],
  'Faculty of Electrical and Computer Engineering': ['Computer Engineering', 'Electrical Engineering'],
  'Faculty of Mechanical and Industrial Engineering': [
    'Automotive Engineering',
    'Industrial Engineering',
    'Mechanical Engineering',
  ],
  'School of Materials Science and Engineering': ['Materials Science and Engineering'],
};

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function slotOnDay(baseDay, dayOffset, startH, startM, durMinutes) {
  const s = addDays(baseDay, dayOffset);
  s.setHours(startH, startM, 0, 0);
  const e = new Date(s.getTime() + durMinutes * 60_000);
  return { start: s, end: e };
}

const prisma = new PrismaClient();

const O_SE_Y5A_1 = 'f0000001-0000-4000-8000-000000000001';
const O_SE_Y5A_2 = 'f0000001-0000-4000-8000-000000000002';
const O_SE_Y5A_PROJ = 'f0000001-0000-4000-8000-000000000003';
const O_SE_Y4B = 'f0000001-0000-4000-8000-000000000004';
const O_CS_Y3 = 'f0000001-0000-4000-8000-000000000005';
const O_IT_Y2 = 'f0000001-0000-4000-8000-000000000006';
const O_EE_Y3 = 'f0000001-0000-4000-8000-000000000007';
const O_SE_DIST = 'f0000001-0000-4000-8000-000000000008';

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[ensure-demo-schedule] Missing DATABASE_URL.');
    process.exit(1);
  }

  await prisma.academicYear.upsert({
    where: { id: AY_ID },
    create: {
      id: AY_ID,
      name: '2026 Academic Year (Hackathon Demo)',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    },
    update: { name: '2026 Academic Year (Hackathon Demo)', isActive: true },
  });
  const ay = await prisma.academicYear.findUniqueOrThrow({ where: { id: AY_ID } });

  const facultyIds = new Map();
  const deptIds = new Map();
  for (const [facName, depts] of Object.entries(FACULTY_DEPTS)) {
    const f = await prisma.faculty.upsert({
      where: { name: facName },
      create: { name: facName },
      update: {},
    });
    facultyIds.set(facName, f.id);
    for (const dName of depts) {
      const d = await prisma.department.upsert({
        where: { facultyId_name: { facultyId: f.id, name: dName } },
        create: { name: dName, facultyId: f.id },
        update: {},
      });
      deptIds.set(`${facName}|${dName}`, d.id);
    }
  }

  const facComputing = facultyIds.get('Faculty of Computing');
  const seDeptId = deptIds.get('Faculty of Computing|Software Engineering');
  const csDeptId = deptIds.get('Faculty of Computing|Computer Science');
  const itDeptId = deptIds.get('Faculty of Computing|Information Technology');
  const eeDeptId = deptIds.get('Faculty of Electrical and Computer Engineering|Electrical Engineering');
  const eeFacultyId = facultyIds.get('Faculty of Electrical and Computer Engineering');

  const pw = await bcrypt.hash(DEMO_PASSWORD, 12);

  const tch1 = await prisma.user.upsert({
    where: { studentId: 'HACKTCH001' },
    create: {
      studentId: 'HACKTCH001',
      name: 'Dr. Selamawit Worku',
      email: 'selamawit.worku@bit.edu.et',
      passwordHash: pw,
      role: 'teacher',
      gender: 'F',
      facultyId: facComputing,
      departmentId: seDeptId,
      isActive: true,
      forcePasswordChange: false,
    },
    update: {
      passwordHash: pw,
      facultyId: facComputing,
      departmentId: seDeptId,
      isActive: true,
      forcePasswordChange: false,
    },
  });
  const tch2 = await prisma.user.upsert({
    where: { studentId: 'HACKTCH002' },
    create: {
      studentId: 'HACKTCH002',
      name: 'Dr. Yonas Bekele',
      email: 'yonas.bekele@bit.edu.et',
      passwordHash: pw,
      role: 'teacher',
      gender: 'M',
      facultyId: facComputing,
      departmentId: csDeptId,
      isActive: true,
      forcePasswordChange: false,
    },
    update: {
      passwordHash: pw,
      facultyId: facComputing,
      departmentId: csDeptId,
      isActive: true,
      forcePasswordChange: false,
    },
  });
  const tch3 = await prisma.user.upsert({
    where: { studentId: 'HACKTCH003' },
    create: {
      studentId: 'HACKTCH003',
      name: 'Dr. Mulugeta Alemayehu',
      email: 'mulugeta.alemayehu@bit.edu.et',
      passwordHash: pw,
      role: 'teacher',
      gender: 'M',
      facultyId: eeFacultyId,
      departmentId: eeDeptId,
      isActive: true,
      forcePasswordChange: false,
    },
    update: {
      passwordHash: pw,
      facultyId: eeFacultyId,
      departmentId: eeDeptId,
      isActive: true,
      forcePasswordChange: false,
    },
  });
  const cr1 = await prisma.user.upsert({
    where: { studentId: 'HACKCR001' },
    create: {
      studentId: 'HACKCR001',
      name: 'Hackathon Class Rep (Y5 A)',
      email: 'hack.cr1@bit.edu.et',
      passwordHash: pw,
      role: 'student',
      gender: 'F',
      facultyId: facComputing,
      departmentId: seDeptId,
      program: 'BSc',
      fieldOfStudy: 'Software Engineering',
      admissionType: 'Regular',
      year: 5,
      section: 'A',
      isActive: true,
      forcePasswordChange: false,
    },
    update: {
      passwordHash: pw,
      facultyId: facComputing,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
      isActive: true,
      forcePasswordChange: false,
    },
  });
  const cr2 = await prisma.user.upsert({
    where: { studentId: 'HACKCR002' },
    create: {
      studentId: 'HACKCR002',
      name: 'Hackathon Class Rep (Y4 B)',
      email: 'hack.cr2@bit.edu.et',
      passwordHash: pw,
      role: 'student',
      gender: 'M',
      facultyId: facComputing,
      departmentId: seDeptId,
      program: 'BSc',
      fieldOfStudy: 'Software Engineering',
      admissionType: 'Extension',
      year: 4,
      section: 'B',
      isActive: true,
      forcePasswordChange: false,
    },
    update: {
      passwordHash: pw,
      isActive: true,
      forcePasswordChange: false,
    },
  });

  await prisma.crAssignment.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000c1' },
    create: {
      id: '00000000-0000-0000-0000-0000000000c1',
      userId: cr1.id,
      academicYearId: ay.id,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
    },
    update: { userId: cr1.id, isActive: true },
  });
  await prisma.crAssignment.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000c2' },
    create: {
      id: '00000000-0000-0000-0000-0000000000c2',
      userId: cr2.id,
      academicYearId: ay.id,
      departmentId: seDeptId,
      year: 4,
      section: 'B',
    },
    update: { userId: cr2.id, isActive: true },
  });

  const courseRows = [
    { id: 'c0000001-0000-4000-8000-000000000001', code: 'SE401', name: 'Software Engineering' },
    { id: 'c0000001-0000-4000-8000-000000000002', code: 'CS401', name: 'Database Systems' },
    { id: 'c0000001-0000-4000-8000-000000000003', code: 'CS305', name: 'Computer Networks' },
    { id: 'c0000001-0000-4000-8000-000000000004', code: 'CS201', name: 'Data Structures and Algorithms' },
    { id: 'c0000001-0000-4000-8000-000000000005', code: 'CS408', name: 'Software Project I' },
    { id: 'c0000001-0000-4000-8000-000000000006', code: 'IT201', name: 'Web Technologies' },
    { id: 'c0000001-0000-4000-8000-000000000007', code: 'EE301', name: 'Signals and Systems' },
    { id: 'c0000001-0000-4000-8000-000000000008', code: 'SE402', name: 'Distributed Systems' },
  ];
  for (const c of courseRows) {
    await prisma.course.upsert({
      where: { id: c.id },
      create: { id: c.id, courseCode: c.code, courseName: c.name },
      update: { courseCode: c.code, courseName: c.name },
    });
  }

  const offeringDefs = [
    {
      id: O_SE_Y5A_1,
      courseId: courseRows[0].id,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
      teacherUserId: tch1.id,
      createdByCrUserId: cr1.id,
    },
    {
      id: O_SE_Y5A_2,
      courseId: courseRows[1].id,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
      teacherUserId: tch1.id,
      createdByCrUserId: cr1.id,
    },
    {
      id: O_SE_Y5A_PROJ,
      courseId: courseRows[4].id,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
      teacherUserId: tch2.id,
    },
    {
      id: O_SE_Y4B,
      courseId: courseRows[3].id,
      departmentId: seDeptId,
      year: 4,
      section: 'B',
      teacherUserId: tch2.id,
      createdByCrUserId: cr2.id,
    },
    {
      id: O_CS_Y3,
      courseId: courseRows[2].id,
      departmentId: csDeptId,
      year: 3,
      section: 'A',
      teacherUserId: tch1.id,
    },
    {
      id: O_IT_Y2,
      courseId: courseRows[5].id,
      departmentId: itDeptId,
      year: 2,
      section: 'C',
      teacherUserId: tch2.id,
    },
    {
      id: O_EE_Y3,
      courseId: courseRows[6].id,
      departmentId: eeDeptId,
      year: 3,
      section: 'A',
      teacherUserId: tch3.id,
    },
    {
      id: O_SE_DIST,
      courseId: courseRows[7].id,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
      teacherUserId: tch2.id,
    },
  ];

  for (const o of offeringDefs) {
    await prisma.courseOffering.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        courseId: o.courseId,
        academicYearId: ay.id,
        departmentId: o.departmentId,
        year: o.year,
        section: o.section,
        teacherUserId: o.teacherUserId,
        createdByCrUserId: o.createdByCrUserId,
      },
      update: {
        teacherUserId: o.teacherUserId,
        createdByCrUserId: o.createdByCrUserId,
        isActive: true,
      },
    });
  }

  async function roomIdByNum(num) {
    const r = await prisma.room.findFirst({
      where: { roomNumber: num, isActive: true },
    });
    if (!r) throw new Error(`[ensure-demo-schedule] Room "${num}" not found — run ensure-demo-campus first.`);
    return r.id;
  }

  const booker = {
    tch1: tch1.id,
    tch2: tch2.id,
    tch3: tch3.id,
    cr1: cr1.id,
    cr2: cr2.id,
  };

  const bookingDefs = [
    ['b0000001-0000-4000-8000-000000000001', 'G-201', 'tch1', O_SE_Y5A_2, 'lecture', -5, 10, 0, 120, 'booked'],
    ['b0000001-0000-4000-8000-000000000002', 'Korya Lab', 'tch2', O_SE_Y5A_PROJ, 'lab', -4, 14, 0, 180, 'booked'],
    ['b0000001-0000-4000-8000-000000000003', 'KEH-G1', 'tch2', O_SE_Y4B, 'exam', -3, 9, 0, 120, 'cancelled'],
    ['b0000001-0000-4000-8000-000000000004', 'G-101', 'tch1', O_SE_Y5A_1, 'lecture', -1, 8, 0, 90, 'booked'],
    ['b0000001-0000-4000-8000-000000000005', 'Audio Visual Lab', 'tch2', O_IT_Y2, 'presentation', 0, 10, 30, 90, 'booked'],
    ['b0000001-0000-4000-8000-000000000006', 'TED-G1', 'tch1', O_CS_Y3, 'tutor', 0, 14, 0, 60, 'booked'],
    ['b0000001-0000-4000-8000-000000000007', 'G-202', 'tch2', O_SE_DIST, 'lecture', 1, 11, 0, 120, 'booked'],
    ['b0000001-0000-4000-8000-000000000008', 'KEH-G2', 'tch3', O_EE_Y3, 'lecture', 1, 15, 0, 90, 'booked'],
    ['b0000001-0000-4000-8000-000000000009', 'G-102', 'cr1', O_SE_Y5A_1, 'presentation', 2, 9, 0, 60, 'booked'],
    ['b0000001-0000-4000-8000-000000000010', 'ANN-301', 'cr1', O_SE_Y5A_2, 'lab', 3, 13, 0, 120, 'booked'],
    ['b0000001-0000-4000-8000-000000000011', 'EW-201', 'cr2', O_SE_Y4B, 'lecture', 2, 10, 0, 90, 'booked'],
    ['b0000001-0000-4000-8000-000000000012', 'TED-G2', 'tch1', O_CS_Y3, 'defense', 4, 9, 0, 240, 'booked'],
    ['b0000001-0000-4000-8000-000000000013', 'G-401', 'tch1', O_SE_Y5A_1, 'lecture', 5, 8, 0, 120, 'booked'],
    ['b0000001-0000-4000-8000-000000000014', 'K-201', 'tch2', O_SE_Y5A_PROJ, 'lab', 5, 14, 0, 120, 'booked'],
    ['b0000001-0000-4000-8000-000000000015', 'ANN-302', 'tch2', O_IT_Y2, 'lecture', 6, 10, 0, 90, 'booked'],
    ['b0000001-0000-4000-8000-000000000016', 'EW-101', 'tch1', O_SE_Y5A_PROJ, 'lab', 7, 11, 0, 180, 'booked'],
    ['b0000001-0000-4000-8000-000000000017', 'G-301', 'tch2', O_CS_Y3, 'tutor', 8, 15, 0, 60, 'booked'],
    ['b0000001-0000-4000-8000-000000000018', 'G-101', 'tch2', O_SE_DIST, 'lecture', 9, 9, 0, 120, 'booked'],
    ['b0000001-0000-4000-8000-000000000019', 'KEH-G1', 'tch1', O_SE_Y5A_2, 'exam', 10, 8, 0, 180, 'booked'],
    ['b0000001-0000-4000-8000-000000000020', 'Korya Lab', 'tch1', O_CS_Y3, 'lab', 11, 13, 0, 120, 'booked'],
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const row of bookingDefs) {
    const [id, roomNum, bk, offeringId, event, dayOff, sh, sm, dur, status] = row;
    const { start, end } = slotOnDay(today, dayOff, sh, sm, dur);
    const roomId = await roomIdByNum(roomNum);
    await prisma.booking.upsert({
      where: { id },
      create: {
        id,
        roomId,
        courseOfferingId: offeringId,
        bookedByUserId: booker[bk],
        eventType: event,
        startTime: start,
        endTime: end,
        status,
      },
      update: {
        roomId,
        courseOfferingId: offeringId,
        bookedByUserId: booker[bk],
        eventType: event,
        startTime: start,
        endTime: end,
        status,
      },
    });
  }

  const bc = await prisma.booking.count({ where: { status: 'booked' } });
  const oc = await prisma.courseOffering.count({ where: { isActive: true } });
  console.log(`[ensure-demo-schedule] OK — ${oc} offerings, ${bc} booked sessions (relative to server “today”).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
