import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

async function main() {
  const ay = await prisma.academicYear.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: '2026 Academic Year',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    },
    update: {},
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

  const seDeptId = deptIds.get('Faculty of Computing|Software Engineering')!;

  const hash = (p: string) => bcrypt.hash(p, 12);

  const adminPw = await hash('admin123');
  await prisma.user.upsert({
    where: { studentId: 'ADMIN001' },
    create: {
      studentId: 'ADMIN001',
      name: 'System Admin',
      passwordHash: adminPw,
      role: 'admin',
      forcePasswordChange: false,
    },
    update: {
      passwordHash: adminPw,
      name: 'System Admin',
      role: 'admin',
      forcePasswordChange: false,
    },
  });

  const teacherPw = await hash('teacher123');
  const teacher = await prisma.user.upsert({
    where: { studentId: 'TCH001' },
    create: {
      studentId: 'TCH001',
      name: 'Dr. Abebe',
      passwordHash: teacherPw,
      role: 'teacher',
      gender: 'M',
      forcePasswordChange: false,
    },
    update: {
      passwordHash: teacherPw,
      name: 'Dr. Abebe',
      role: 'teacher',
      gender: 'M',
      forcePasswordChange: false,
    },
  });

  const stuPw = await hash('123456');
  const stu = await prisma.user.upsert({
    where: { studentId: 'STU001' },
    create: {
      studentId: 'STU001',
      name: 'Eden Student',
      passwordHash: stuPw,
      role: 'student',
      gender: 'M',
      facultyId: facultyIds.get('Faculty of Computing')!,
      departmentId: seDeptId,
      program: 'Degree',
      fieldOfStudy: 'Software Engineering',
      admissionType: 'Regular',
      year: 5,
      section: 'A',
      forcePasswordChange: true,
    },
    update: {
      passwordHash: stuPw,
      name: 'Eden Student',
      facultyId: facultyIds.get('Faculty of Computing')!,
      departmentId: seDeptId,
      program: 'Degree',
      fieldOfStudy: 'Software Engineering',
      year: 5,
      section: 'A',
      forcePasswordChange: true,
    },
  });

  const crPw = await hash('123456');
  const cr = await prisma.user.upsert({
    where: { studentId: 'CR001' },
    create: {
      studentId: 'CR001',
      name: 'Class Rep',
      passwordHash: crPw,
      role: 'student',
      gender: 'M',
      facultyId: facultyIds.get('Faculty of Computing')!,
      departmentId: seDeptId,
      program: 'Degree',
      fieldOfStudy: 'Software Engineering',
      year: 5,
      section: 'A',
      forcePasswordChange: true,
    },
    update: {
      passwordHash: crPw,
      name: 'Class Rep',
      facultyId: facultyIds.get('Faculty of Computing')!,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
      forcePasswordChange: true,
    },
  });

  await prisma.crAssignment.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000c1' },
    create: {
      id: '00000000-0000-0000-0000-0000000000c1',
      userId: cr.id,
      academicYearId: ay.id,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
    },
    update: {},
  });

  const gion = await prisma.building.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b1' },
    create: {
      id: '00000000-0000-0000-0000-0000000000b1',
      name: 'Gion Building',
      floorCount: 5,
    },
    update: {},
  });

  await prisma.building.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000b2' },
    create: {
      id: '00000000-0000-0000-0000-0000000000b2',
      name: 'Engineering Block',
      floorCount: 4,
    },
    update: {},
  });

  const rooms = [
    { id: '00000000-0000-0000-0000-00000000r101', num: 'G-101', floor: 0, cap: 60 },
    { id: '00000000-0000-0000-0000-00000000r201', num: 'G-201', floor: 1, cap: 50 },
    { id: '00000000-0000-0000-0000-00000000r202', num: 'G-202', floor: 1, cap: 50 },
  ];

  for (const r of rooms) {
    await prisma.room.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        roomNumber: r.num,
        buildingId: gion.id,
        floorIndex: r.floor,
        capacity: r.cap,
        roomType: 'lecture_hall',
        hasProjector: true,
        hasInternet: true,
        hasPower: true,
        equipmentJson: JSON.stringify(['Internet', 'Projector']),
      },
      update: {
        hasProjector: true,
        hasInternet: true,
      },
    });
  }

  const course = await prisma.course.upsert({
    where: { id: '00000000-0000-0000-0000-00000000c01' },
    create: {
      id: '00000000-0000-0000-0000-00000000c01',
      courseName: 'Database Systems',
      courseCode: 'CS401',
    },
    update: {},
  });

  const offering = await prisma.courseOffering.upsert({
    where: { id: '00000000-0000-0000-0000-00000000o01' },
    create: {
      id: '00000000-0000-0000-0000-00000000o01',
      courseId: course.id,
      academicYearId: ay.id,
      departmentId: seDeptId,
      year: 5,
      section: 'A',
      teacherUserId: teacher.id,
      createdByCrUserId: cr.id,
    },
    update: {},
  });

  const t1 = new Date();
  t1.setHours(t1.getHours() + 2, 0, 0, 0);
  const t2 = new Date(t1);
  t2.setHours(t2.getHours() + 2);

  await prisma.booking.upsert({
    where: { id: '00000000-0000-0000-0000-00000000bk1' },
    create: {
      id: '00000000-0000-0000-0000-00000000bk1',
      roomId: '00000000-0000-0000-0000-00000000r201',
      courseOfferingId: offering.id,
      bookedByUserId: teacher.id,
      startTime: t1,
      endTime: t2,
      status: 'booked',
    },
    update: {},
  });

  console.log('Seed OK. Demo logins:');
  console.log('  ADMIN001 / admin123');
  console.log('  TCH001 / teacher123');
  console.log('  STU001 / 123456 (must change password first)');
  console.log('  CR001 / 123456 (must change password first)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
