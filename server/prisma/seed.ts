import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sem = await prisma.semester.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: '2026 Semester 1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
      isActive: true,
    },
    update: {},
  });

  const hash = (p: string) => bcrypt.hash(p, 12);

  const adminPw = await hash('admin123');
  const admin = await prisma.user.upsert({
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
      department: 'Software Engineering',
      forcePasswordChange: false,
    },
    update: {
      passwordHash: teacherPw,
      name: 'Dr. Abebe',
      role: 'teacher',
      department: 'Software Engineering',
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
      department: 'Software Engineering',
      year: 5,
      classSection: 'A',
      forcePasswordChange: true,
    },
    update: {
      passwordHash: stuPw,
      name: 'Eden Student',
      department: 'Software Engineering',
      year: 5,
      classSection: 'A',
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
      department: 'Software Engineering',
      year: 5,
      classSection: 'A',
      forcePasswordChange: true,
    },
    update: {
      passwordHash: crPw,
      name: 'Class Rep',
      department: 'Software Engineering',
      year: 5,
      classSection: 'A',
      forcePasswordChange: true,
    },
  });

  await prisma.crAssignment.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000c1' },
    create: {
      id: '00000000-0000-0000-0000-0000000000c1',
      userId: cr.id,
      semesterId: sem.id,
      department: 'Software Engineering',
      year: 5,
      classSection: 'A',
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
        equipmentJson: JSON.stringify(['Internet', 'Projector']),
      },
      update: {},
    });
  }

  const course = await prisma.course.upsert({
    where: { id: '00000000-0000-0000-0000-00000000c01' },
    create: {
      id: '00000000-0000-0000-0000-00000000c01',
      courseName: 'Database Systems',
      department: 'Software Engineering',
      year: 5,
      classSection: 'A',
      semesterId: sem.id,
      teacherUserId: teacher.id,
      teacherContact: '+251900000000',
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
      courseId: course.id,
      teacherUserId: teacher.id,
      department: 'Software Engineering',
      year: 5,
      classSection: 'A',
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
