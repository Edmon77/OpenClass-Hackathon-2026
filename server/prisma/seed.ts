import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, type EventType, type NotificationType, type RoomType } from '@prisma/client';

const prisma = new PrismaClient();

/** Bahir Dar Institute of Technology (BiT) — faculties and departments (aligned with campus structure). */
const FACULTY_DEPTS: Record<string, string[]> = {
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

const AY_ID = '00000000-0000-0000-0000-000000000001';

/** Single password for all hackathon demo accounts (easy for judges). */
const DEMO_PASSWORD = 'Hackathon2026';

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Campus-style slots in local wall time; DB stores absolute instants. */
function slotOnDay(baseDay: Date, dayOffset: number, startH: number, startM: number, durMinutes: number) {
  const s = addDays(baseDay, dayOffset);
  s.setHours(startH, startM, 0, 0);
  const e = new Date(s.getTime() + durMinutes * 60_000);
  return { start: s, end: e };
}

async function main() {
  console.log('[prisma seed] Starting hackathon demo seed (Bahir Dar BiT)…');
  const pw = await bcrypt.hash(DEMO_PASSWORD, 12);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ay = await prisma.academicYear.upsert({
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

  const facultyIds = new Map<string, string>();
  const deptIds = new Map<string, string>();

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

  const facComputing = facultyIds.get('Faculty of Computing')!;
  const seDeptId = deptIds.get('Faculty of Computing|Software Engineering')!;
  const csDeptId = deptIds.get('Faculty of Computing|Computer Science')!;
  const itDeptId = deptIds.get('Faculty of Computing|Information Technology')!;
  const eeDeptId = deptIds.get('Faculty of Electrical and Computer Engineering|Electrical Engineering')!;

  // --- Buildings (Bahir Dar University BiT campus + plausible extras) ---
  const bGion = await prisma.building.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b1' },
    create: {
      id: '00000000-0000-0000-0000-0000000000b1',
      name: 'Gion Building',
      floorCount: 5,
    },
    update: { name: 'Gion Building', floorCount: 5 },
  });

  const bKorya = await prisma.building.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b2' },
    create: {
      id: '00000000-0000-0000-0000-0000000000b2',
      name: 'Korya Laboratory',
      floorCount: 2,
    },
    update: { name: 'Korya Laboratory', floorCount: 2 },
  });

  const bKehas = await prisma.building.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b3' },
    create: {
      id: '00000000-0000-0000-0000-0000000000b3',
      name: 'Kehas Hall',
      floorCount: 1,
    },
    update: { name: 'Kehas Hall', floorCount: 1 },
  });

  const bTedros = await prisma.building.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b4' },
    create: {
      id: '00000000-0000-0000-0000-0000000000b4',
      name: 'Tedros Hall',
      floorCount: 1,
    },
    update: { name: 'Tedros Hall', floorCount: 1 },
  });

  const bEng = await prisma.building.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b5' },
    create: {
      id: '00000000-0000-0000-0000-0000000000b5',
      name: 'Engineering Workshop Block',
      floorCount: 3,
    },
    update: { name: 'Engineering Workshop Block', floorCount: 3 },
  });

  const bAnnex = await prisma.building.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b6' },
    create: {
      id: '00000000-0000-0000-0000-0000000000b6',
      name: 'BIT Innovation Annex',
      floorCount: 4,
    },
    update: { name: 'BIT Innovation Annex', floorCount: 4 },
  });

  type RoomSeed = {
    id: string;
    num: string;
    buildingId: string;
    floor: number;
    cap: number;
    type: RoomType;
    projector?: boolean;
    net?: boolean;
    equipment?: string[];
  };

  const roomSeeds: RoomSeed[] = [
    // Gion — mixed floors
    {
      id: '20000000-0000-4000-8000-000000000101',
      num: 'G-101',
      buildingId: bGion.id,
      floor: 0,
      cap: 120,
      type: 'lecture_hall',
      projector: true,
      net: true,
      equipment: ['Projector', 'PA', 'Wi‑Fi'],
    },
    {
      id: '20000000-0000-4000-8000-000000000102',
      num: 'G-102',
      buildingId: bGion.id,
      floor: 0,
      cap: 90,
      type: 'lecture_hall',
      projector: true,
      net: true,
    },
    {
      id: '20000000-0000-4000-8000-000000000201',
      num: 'G-201',
      buildingId: bGion.id,
      floor: 1,
      cap: 60,
      type: 'seminar',
      projector: true,
      net: true,
    },
    {
      id: '20000000-0000-4000-8000-000000000202',
      num: 'G-202',
      buildingId: bGion.id,
      floor: 1,
      cap: 50,
      type: 'lecture_hall',
      projector: true,
      net: true,
    },
    {
      id: '20000000-0000-4000-8000-000000000301',
      num: 'G-301',
      buildingId: bGion.id,
      floor: 2,
      cap: 45,
      type: 'office',
      projector: false,
      net: true,
    },
    {
      id: '20000000-0000-4000-8000-000000000401',
      num: 'G-401',
      buildingId: bGion.id,
      floor: 3,
      cap: 70,
      type: 'lecture_hall',
      projector: true,
      net: true,
    },
    // Korya — known labs
    {
      id: '20000000-0000-4000-8000-000000000501',
      num: 'Korya Lab',
      buildingId: bKorya.id,
      floor: 0,
      cap: 40,
      type: 'lab',
      projector: true,
      net: true,
      equipment: ['Workstations', 'Linux lab image'],
    },
    {
      id: '20000000-0000-4000-8000-000000000502',
      num: 'Audio Visual Lab',
      buildingId: bKorya.id,
      floor: 0,
      cap: 35,
      type: 'lab',
      projector: true,
      net: true,
      equipment: ['AV rack', 'Recording kit'],
    },
    {
      id: '20000000-0000-4000-8000-000000000503',
      num: 'K-201',
      buildingId: bKorya.id,
      floor: 1,
      cap: 30,
      type: 'lab',
      net: true,
    },
    // Kehas — ground only
    {
      id: '20000000-0000-4000-8000-000000000601',
      num: 'KEH-G1',
      buildingId: bKehas.id,
      floor: 0,
      cap: 280,
      type: 'lecture_hall',
      projector: true,
      net: true,
      equipment: ['Large hall', 'Dual projectors'],
    },
    {
      id: '20000000-0000-4000-8000-000000000602',
      num: 'KEH-G2',
      buildingId: bKehas.id,
      floor: 0,
      cap: 200,
      type: 'lecture_hall',
      projector: true,
      net: true,
    },
    // Tedros — ground only
    {
      id: '20000000-0000-4000-8000-000000000701',
      num: 'TED-G1',
      buildingId: bTedros.id,
      floor: 0,
      cap: 220,
      type: 'lecture_hall',
      projector: true,
      net: true,
    },
    {
      id: '20000000-0000-4000-8000-000000000702',
      num: 'TED-G2',
      buildingId: bTedros.id,
      floor: 0,
      cap: 160,
      type: 'seminar',
      projector: true,
      net: true,
    },
    // Engineering workshop
    {
      id: '20000000-0000-4000-8000-000000000801',
      num: 'EW-101',
      buildingId: bEng.id,
      floor: 0,
      cap: 25,
      type: 'lab',
      net: true,
      equipment: ['3D printers', 'Bench tools'],
    },
    {
      id: '20000000-0000-4000-8000-000000000802',
      num: 'EW-201',
      buildingId: bEng.id,
      floor: 1,
      cap: 50,
      type: 'lecture_hall',
      projector: true,
      net: true,
    },
    // Annex
    {
      id: '20000000-0000-4000-8000-000000000901',
      num: 'ANN-301',
      buildingId: bAnnex.id,
      floor: 2,
      cap: 80,
      type: 'lecture_hall',
      projector: true,
      net: true,
    },
    {
      id: '20000000-0000-4000-8000-000000000902',
      num: 'ANN-302',
      buildingId: bAnnex.id,
      floor: 2,
      cap: 40,
      type: 'seminar',
      projector: true,
      net: true,
    },
  ];

  for (const r of roomSeeds) {
    await prisma.room.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        roomNumber: r.num,
        buildingId: r.buildingId,
        floorIndex: r.floor,
        capacity: r.cap,
        roomType: r.type,
        hasProjector: r.projector ?? false,
        hasInternet: r.net ?? true,
        hasPower: true,
        equipmentJson: r.equipment ? JSON.stringify(r.equipment) : null,
      },
      update: {
        capacity: r.cap,
        roomType: r.type,
        hasProjector: r.projector ?? false,
        hasInternet: r.net ?? true,
        equipmentJson: r.equipment ? JSON.stringify(r.equipment) : null,
      },
    });
  }

  const roomByNum = (num: string) => roomSeeds.find((x) => x.num === num)!.id;

  // --- Hackathon demo users (login = studentId, Faculty of Computing / SE where applicable) ---
  const hackAdmin = await prisma.user.upsert({
    where: { studentId: 'HACKADM001' },
    create: {
      studentId: 'HACKADM001',
      name: 'Hackathon Admin',
      email: 'hackathon.admin@bit.edu.et',
      passwordHash: pw,
      role: 'admin',
      facultyId: facComputing,
      departmentId: seDeptId,
      forcePasswordChange: false,
    },
    update: {
      name: 'Hackathon Admin',
      passwordHash: pw,
      facultyId: facComputing,
      departmentId: seDeptId,
      forcePasswordChange: false,
    },
  });

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
      forcePasswordChange: false,
    },
    update: {
      name: 'Dr. Selamawit Worku',
      passwordHash: pw,
      facultyId: facComputing,
      departmentId: seDeptId,
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
      forcePasswordChange: false,
    },
    update: {
      name: 'Dr. Yonas Bekele',
      passwordHash: pw,
      facultyId: facComputing,
      departmentId: csDeptId,
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
      facultyId: facultyIds.get('Faculty of Electrical and Computer Engineering')!,
      departmentId: eeDeptId,
      forcePasswordChange: false,
    },
    update: {
      name: 'Dr. Mulugeta Alemayehu',
      passwordHash: pw,
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
      forcePasswordChange: false,
    },
    update: {
      name: 'Hackathon Class Rep (Y5 A)',
      passwordHash: pw,
      facultyId: facComputing,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
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
      forcePasswordChange: false,
    },
    update: {
      name: 'Hackathon Class Rep (Y4 B)',
      passwordHash: pw,
      forcePasswordChange: false,
    },
  });

  const studentSpecs: {
    sid: string;
    name: string;
    year: number;
    section: string;
    deptKey: string;
    gender: string;
  }[] = [
    { sid: 'HACKSTU001', name: 'Hackathon Student One', year: 5, section: 'A', deptKey: 'Faculty of Computing|Software Engineering', gender: 'M' },
    { sid: 'HACKSTU002', name: 'Hackathon Student Two', year: 5, section: 'A', deptKey: 'Faculty of Computing|Software Engineering', gender: 'F' },
    { sid: 'HACKSTU003', name: 'Hackathon Student Three', year: 5, section: 'A', deptKey: 'Faculty of Computing|Software Engineering', gender: 'M' },
    { sid: 'HACKSTU004', name: 'Hackathon Student Four', year: 4, section: 'B', deptKey: 'Faculty of Computing|Software Engineering', gender: 'F' },
    { sid: 'HACKSTU005', name: 'Hackathon Student Five', year: 4, section: 'B', deptKey: 'Faculty of Computing|Software Engineering', gender: 'M' },
    { sid: 'HACKSTU006', name: 'Hackathon Student Six', year: 3, section: 'A', deptKey: 'Faculty of Computing|Computer Science', gender: 'M' },
    { sid: 'HACKSTU007', name: 'Hackathon Student Seven', year: 3, section: 'A', deptKey: 'Faculty of Computing|Computer Science', gender: 'F' },
    { sid: 'HACKSTU008', name: 'Hackathon Student Eight', year: 2, section: 'C', deptKey: 'Faculty of Computing|Information Technology', gender: 'M' },
    { sid: 'HACKSTU009', name: 'Hackathon Student Nine', year: 2, section: 'C', deptKey: 'Faculty of Computing|Information Technology', gender: 'F' },
    { sid: 'HACKSTU010', name: 'Hackathon Student Ten', year: 1, section: 'A', deptKey: 'Faculty of Computing|Pre-Fresh(Computing)', gender: 'M' },
    { sid: 'HACKSTU011', name: 'Liya Tadesse', year: 5, section: 'A', deptKey: 'Faculty of Computing|Software Engineering', gender: 'F' },
    { sid: 'HACKSTU012', name: 'Binyam Solomon', year: 5, section: 'A', deptKey: 'Faculty of Computing|Software Engineering', gender: 'M' },
    { sid: 'HACKSTU013', name: 'Meron Haile', year: 4, section: 'B', deptKey: 'Faculty of Computing|Software Engineering', gender: 'F' },
    { sid: 'HACKSTU014', name: 'Dawit Getachew', year: 3, section: 'A', deptKey: 'Faculty of Computing|Computer Science', gender: 'M' },
    { sid: 'HACKSTU015', name: 'Hanna Mekonnen', year: 3, section: 'A', deptKey: 'Faculty of Computing|Computer Science', gender: 'F' },
  ];

  const stuUsers: { sid: string; id: string }[] = [];
  for (const s of studentSpecs) {
    const did = deptIds.get(s.deptKey)!;
    const [facName, depName] = s.deptKey.split('|');
    const u = await prisma.user.upsert({
      where: { studentId: s.sid },
      create: {
        studentId: s.sid,
        name: s.name,
        email: `${s.sid.toLowerCase()}@demo.bit.edu.et`,
        passwordHash: pw,
        role: 'student',
        gender: s.gender,
        facultyId: facultyIds.get(facName)!,
        departmentId: did,
        program: 'BSc',
        fieldOfStudy: depName,
        admissionType: 'Regular',
        year: s.year,
        section: s.section,
        forcePasswordChange: false,
      },
      update: {
        name: s.name,
        passwordHash: pw,
        year: s.year,
        section: s.section,
        forcePasswordChange: false,
      },
    });
    stuUsers.push({ sid: s.sid, id: u.id });
  }

  // Legacy quick accounts (still useful for READMEs) — same demo password
  await prisma.user.upsert({
    where: { studentId: 'ADMIN001' },
    create: {
      studentId: 'ADMIN001',
      name: 'System Admin (legacy)',
      passwordHash: pw,
      role: 'admin',
      forcePasswordChange: false,
    },
    update: { passwordHash: pw, forcePasswordChange: false },
  });

  await prisma.user.upsert({
    where: { studentId: 'STU001' },
    create: {
      studentId: 'STU001',
      name: 'Eden Student',
      passwordHash: pw,
      role: 'student',
      gender: 'M',
      facultyId: facComputing,
      departmentId: seDeptId,
      program: 'BSc',
      fieldOfStudy: 'Software Engineering',
      year: 5,
      section: 'A',
      forcePasswordChange: false,
    },
    update: { passwordHash: pw, forcePasswordChange: false },
  });

  // --- CR assignments (active academic year) ---
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

  // --- Course catalog ---
  const courseRows: { id: string; code: string; name: string }[] = [
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

  const offeringDefs: {
    id: string;
    courseId: string;
    departmentId: string;
    year: number;
    section: string | null;
    teacherUserId: string;
    createdByCrUserId?: string;
  }[] = [
    {
      id: 'f0000001-0000-4000-8000-000000000001',
      courseId: courseRows[0].id,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
      teacherUserId: tch1.id,
      createdByCrUserId: cr1.id,
    },
    {
      id: 'f0000001-0000-4000-8000-000000000002',
      courseId: courseRows[1].id,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
      teacherUserId: tch1.id,
      createdByCrUserId: cr1.id,
    },
    {
      id: 'f0000001-0000-4000-8000-000000000003',
      courseId: courseRows[4].id,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
      teacherUserId: tch2.id,
    },
    {
      id: 'f0000001-0000-4000-8000-000000000004',
      courseId: courseRows[3].id,
      departmentId: seDeptId,
      year: 4,
      section: 'B',
      teacherUserId: tch2.id,
      createdByCrUserId: cr2.id,
    },
    {
      id: 'f0000001-0000-4000-8000-000000000005',
      courseId: courseRows[2].id,
      departmentId: csDeptId,
      year: 3,
      section: 'A',
      teacherUserId: tch1.id,
    },
    {
      id: 'f0000001-0000-4000-8000-000000000006',
      courseId: courseRows[5].id,
      departmentId: itDeptId,
      year: 2,
      section: 'C',
      teacherUserId: tch2.id,
    },
    {
      id: 'f0000001-0000-4000-8000-000000000007',
      courseId: courseRows[6].id,
      departmentId: eeDeptId,
      year: 3,
      section: 'A',
      teacherUserId: tch3.id,
    },
    {
      id: 'f0000001-0000-4000-8000-000000000008',
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

  const O_SE_Y5A_1 = 'f0000001-0000-4000-8000-000000000001';
  const O_SE_Y5A_2 = 'f0000001-0000-4000-8000-000000000002';
  const O_SE_Y5A_PROJ = 'f0000001-0000-4000-8000-000000000003';
  const O_SE_Y4B = 'f0000001-0000-4000-8000-000000000004';
  const O_CS_Y3 = 'f0000001-0000-4000-8000-000000000005';
  const O_IT_Y2 = 'f0000001-0000-4000-8000-000000000006';
  const O_EE_Y3 = 'f0000001-0000-4000-8000-000000000007';
  const O_SE_DIST = 'f0000001-0000-4000-8000-000000000008';

  type Bk = {
    id: string;
    roomNum: string;
    offeringId: string;
    bookerId: string;
    event: EventType;
    dayOff: number;
    sh: number;
    sm: number;
    dur: number;
    status: 'booked' | 'cancelled';
  };

  const bookings: Bk[] = [
    // Past week — history + cancelled example
    {
      id: 'b0000001-0000-4000-8000-000000000001',
      roomNum: 'G-201',
      offeringId: O_SE_Y5A_2,
      bookerId: tch1.id,
      event: 'lecture',
      dayOff: -5,
      sh: 10,
      sm: 0,
      dur: 120,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000002',
      roomNum: 'Korya Lab',
      offeringId: O_SE_Y5A_PROJ,
      bookerId: tch2.id,
      event: 'lab',
      dayOff: -4,
      sh: 14,
      sm: 0,
      dur: 180,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000003',
      roomNum: 'KEH-G1',
      offeringId: O_SE_Y4B,
      bookerId: tch2.id,
      event: 'exam',
      dayOff: -3,
      sh: 9,
      sm: 0,
      dur: 120,
      status: 'cancelled',
    },
    // Yesterday / today / tomorrow
    {
      id: 'b0000001-0000-4000-8000-000000000004',
      roomNum: 'G-101',
      offeringId: O_SE_Y5A_1,
      bookerId: tch1.id,
      event: 'lecture',
      dayOff: -1,
      sh: 8,
      sm: 0,
      dur: 90,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000005',
      roomNum: 'Audio Visual Lab',
      offeringId: O_IT_Y2,
      bookerId: tch2.id,
      event: 'presentation',
      dayOff: 0,
      sh: 10,
      sm: 30,
      dur: 90,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000006',
      roomNum: 'TED-G1',
      offeringId: O_CS_Y3,
      bookerId: tch1.id,
      event: 'tutor',
      dayOff: 0,
      sh: 14,
      sm: 0,
      dur: 60,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000007',
      roomNum: 'G-202',
      offeringId: O_SE_DIST,
      bookerId: tch2.id,
      event: 'lecture',
      dayOff: 1,
      sh: 11,
      sm: 0,
      dur: 120,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000008',
      roomNum: 'KEH-G2',
      offeringId: O_EE_Y3,
      bookerId: tch3.id,
      event: 'lecture',
      dayOff: 1,
      sh: 15,
      sm: 0,
      dur: 90,
      status: 'booked',
    },
    // CR-booked (allowed event types for CR)
    {
      id: 'b0000001-0000-4000-8000-000000000009',
      roomNum: 'G-102',
      offeringId: O_SE_Y5A_1,
      bookerId: cr1.id,
      event: 'presentation',
      dayOff: 2,
      sh: 9,
      sm: 0,
      dur: 60,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000010',
      roomNum: 'ANN-301',
      offeringId: O_SE_Y5A_2,
      bookerId: cr1.id,
      event: 'lab',
      dayOff: 3,
      sh: 13,
      sm: 0,
      dur: 120,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000011',
      roomNum: 'EW-201',
      offeringId: O_SE_Y4B,
      bookerId: cr2.id,
      event: 'lecture',
      dayOff: 2,
      sh: 10,
      sm: 0,
      dur: 90,
      status: 'booked',
    },
    // More spread (no overlapping same room — rough check by eye)
    {
      id: 'b0000001-0000-4000-8000-000000000012',
      roomNum: 'TED-G2',
      offeringId: O_CS_Y3,
      bookerId: tch1.id,
      event: 'defense',
      dayOff: 4,
      sh: 9,
      sm: 0,
      dur: 240,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000013',
      roomNum: 'G-401',
      offeringId: O_SE_Y5A_1,
      bookerId: tch1.id,
      event: 'lecture',
      dayOff: 5,
      sh: 8,
      sm: 0,
      dur: 120,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000014',
      roomNum: 'K-201',
      offeringId: O_SE_Y5A_PROJ,
      bookerId: tch2.id,
      event: 'lab',
      dayOff: 5,
      sh: 14,
      sm: 0,
      dur: 120,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000015',
      roomNum: 'ANN-302',
      offeringId: O_IT_Y2,
      bookerId: tch2.id,
      event: 'lecture',
      dayOff: 6,
      sh: 10,
      sm: 0,
      dur: 90,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000016',
      roomNum: 'EW-101',
      offeringId: O_SE_Y5A_PROJ,
      bookerId: tch1.id,
      event: 'lab',
      dayOff: 7,
      sh: 11,
      sm: 0,
      dur: 180,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000017',
      roomNum: 'G-301',
      offeringId: O_CS_Y3,
      bookerId: tch2.id,
      event: 'tutor',
      dayOff: 8,
      sh: 15,
      sm: 0,
      dur: 60,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000018',
      roomNum: 'G-101',
      offeringId: O_SE_DIST,
      bookerId: tch2.id,
      event: 'lecture',
      dayOff: 9,
      sh: 9,
      sm: 0,
      dur: 120,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000019',
      roomNum: 'KEH-G1',
      offeringId: O_SE_Y5A_2,
      bookerId: tch1.id,
      event: 'exam',
      dayOff: 10,
      sh: 8,
      sm: 0,
      dur: 180,
      status: 'booked',
    },
    {
      id: 'b0000001-0000-4000-8000-000000000020',
      roomNum: 'Korya Lab',
      offeringId: O_CS_Y3,
      bookerId: tch1.id,
      event: 'lab',
      dayOff: 11,
      sh: 13,
      sm: 0,
      dur: 120,
      status: 'booked',
    },
  ];

  for (const b of bookings) {
    const { start, end } = slotOnDay(today, b.dayOff, b.sh, b.sm, b.dur);
    await prisma.booking.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        roomId: roomByNum(b.roomNum),
        courseOfferingId: b.offeringId,
        bookedByUserId: b.bookerId,
        eventType: b.event,
        startTime: start,
        endTime: end,
        status: b.status,
      },
      update: {
        startTime: start,
        endTime: end,
        status: b.status,
        eventType: b.event,
      },
    });
  }

  const hackStu1 = stuUsers.find((x) => x.sid === 'HACKSTU001')!;

  // --- Notifications (in-app feed) ---
  const notifs: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    bookingId?: string;
    read: boolean;
  }[] = [
    {
      id: 'a0000001-0000-4000-8000-000000000001',
      userId: hackStu1.id,
      type: 'advance',
      title: 'Class reminder',
      message: 'Software Engineering lecture tomorrow at Gion G-101 (check schedule in app).',
      read: false,
    },
    {
      id: 'a0000001-0000-4000-8000-000000000002',
      userId: hackStu1.id,
      type: 'class_start',
      title: 'Session starting',
      message: 'Database lab session in Korya Lab area — verify room on map.',
      read: true,
    },
    {
      id: 'a0000001-0000-4000-8000-000000000003',
      userId: cr1.id,
      type: 'cutoff_warning',
      title: 'Booking cutoff',
      message: 'Room change requests for Kehas Hall must be before the 10‑minute policy window.',
      read: false,
    },
    {
      id: 'a0000001-0000-4000-8000-000000000004',
      userId: tch1.id,
      type: 'advance',
      title: 'Weekly schedule',
      message: 'You have 4 confirmed sessions this week across Gion and Korya.',
      read: false,
    },
    {
      id: 'a0000001-0000-4000-8000-000000000005',
      userId: hackAdmin.id,
      type: 'cancelled',
      title: 'Booking cancelled',
      message: 'Exam booking KEH-G1 (demo) was cancelled — slot released.',
      bookingId: 'b0000001-0000-4000-8000-000000000003',
      read: true,
    },
  ];

  for (const n of notifs) {
    await prisma.notification.upsert({
      where: { id: n.id },
      create: {
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.read,
        bookingId: n.bookingId,
        deliveredAt: new Date(),
      },
      update: {
        title: n.title,
        message: n.message,
        isRead: n.read,
      },
    });
  }

  const alertExp = addDays(today, 30);
  alertExp.setHours(23, 59, 0, 0);

  await prisma.roomAlertSubscription.upsert({
    where: { id: 'de000001-0000-4000-8000-000000000001' },
    create: {
      id: 'de000001-0000-4000-8000-000000000001',
      userId: hackStu1.id,
      roomId: roomByNum('G-101'),
      notifyBeforeMinutes: 15,
      expiresAt: alertExp,
      status: 'active',
    },
    update: { status: 'active', expiresAt: alertExp },
  });

  await prisma.roomAlertSubscription.upsert({
    where: { id: 'de000001-0000-4000-8000-000000000002' },
    create: {
      id: 'de000001-0000-4000-8000-000000000002',
      userId: cr1.id,
      roomId: roomByNum('KEH-G1'),
      notifyBeforeMinutes: 10,
      expiresAt: alertExp,
      status: 'active',
    },
    update: { status: 'active', expiresAt: alertExp },
  });

  console.log('\n✅ Hackathon seed complete (Bahir Dar BiT demo).\n');
  console.log('Password for ALL demo accounts below:', DEMO_PASSWORD);
  console.log('\n— Hackathon showcase accounts (Faculty of Computing / SE where noted) —');
  console.log('  HACKADM001  — Hackathon Admin (admin, linked to Computing/SE)');
  console.log('  HACKTCH001  — Dr. Selamawit Worku (teacher, SE)');
  console.log('  HACKTCH002  — Dr. Yonas Bekele (teacher, CS)');
  console.log('  HACKTCH003  — Dr. Mulugeta Alemayehu (teacher, Electrical Eng.)');
  console.log('  HACKCR001   — Class rep Software Eng. Year 5 Section A');
  console.log('  HACKCR002   — Class rep Software Eng. Year 4 Section B');
  console.log('  HACKSTU001–015 — Students (SE / CS / IT / Pre-Fresh mix)');
  console.log('\n— Legacy IDs (same password) —');
  console.log('  ADMIN001    — System Admin (legacy)');
  console.log('  STU001      — Eden Student (SE Y5 A)');
  console.log('\n— Campus —');
  console.log('  Buildings: Gion, Korya Laboratory (Korya Lab + Audio Visual Lab), Kehas Hall, Tedros Hall, …');
  console.log('  Bookings span past → +11 days from today for schedules, explore, and assistant queries.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
