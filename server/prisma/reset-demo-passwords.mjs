/**
 * Forces bcrypt hash + isActive for hackathon demo logins.
 * Run after `prisma db seed` (e.g. Docker CMD) so logins work even if seed TS step was skipped.
 * Uses DATABASE_URL from the environment (set by Docker Compose or server/.env).
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

const DEMO_PASSWORD = 'Hackathon2026';
const DEMO_IDS = [
  'HACKADM001',
  'HACKTCH001',
  'HACKTCH002',
  'HACKTCH003',
  'HACKCR001',
  'HACKCR002',
  'ADMIN001',
  'STU001',
  ...Array.from({ length: 15 }, (_, i) => `HACKSTU${String(i + 1).padStart(3, '0')}`),
];

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[reset-demo-passwords] Missing DATABASE_URL.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  let updated = 0;
  for (const studentId of DEMO_IDS) {
    const r = await prisma.user.updateMany({
      where: { studentId },
      data: { passwordHash: hash, isActive: true },
    });
    updated += r.count;
  }

  const seDept = await prisma.department.findFirst({
    where: { name: 'Software Engineering', faculty: { name: 'Faculty of Computing' } },
    select: { id: true, facultyId: true },
  });
  const hackStu1Profile =
    seDept != null
      ? {
          facultyId: seDept.facultyId,
          departmentId: seDept.id,
          year: 5,
          section: 'A',
          gender: 'M',
          fieldOfStudy: 'Software Engineering',
          program: 'BSc',
          admissionType: 'Regular',
          email: 'hackstu001@demo.bit.edu.et',
        }
      : {};

  // If full seed never created rows, still allow the two main hackathon logins.
  await prisma.user.upsert({
    where: { studentId: 'HACKADM001' },
    create: {
      studentId: 'HACKADM001',
      name: 'Hackathon Admin',
      passwordHash: hash,
      role: 'admin',
      isActive: true,
      forcePasswordChange: false,
    },
    update: { passwordHash: hash, isActive: true, forcePasswordChange: false },
  });
  await prisma.user.upsert({
    where: { studentId: 'HACKSTU001' },
    create: {
      studentId: 'HACKSTU001',
      name: 'Hackathon Student One',
      passwordHash: hash,
      role: 'student',
      isActive: true,
      forcePasswordChange: false,
      ...hackStu1Profile,
    },
    update: {
      passwordHash: hash,
      isActive: true,
      forcePasswordChange: false,
      ...hackStu1Profile,
    },
  });

  const totalUsers = await prisma.user.count();
  const matched = await prisma.user.count({ where: { studentId: { in: DEMO_IDS } } });
  console.log(
    `[reset-demo-passwords] bcrypt updated ${updated} row(s); ${matched}/${DEMO_IDS.length} demo IDs exist (${totalUsers} users total). Password: ${DEMO_PASSWORD}`
  );

  const stu = await prisma.user.findUnique({ where: { studentId: 'HACKSTU001' } });
  if (stu) {
    const ok = await bcrypt.compare(DEMO_PASSWORD, stu.passwordHash);
    console.log(`[reset-demo-passwords] Self-check HACKSTU001 + "${DEMO_PASSWORD}": ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) console.error('[reset-demo-passwords] bcrypt self-check failed — investigate bcryptjs / DB column.');
  } else {
    console.error('[reset-demo-passwords] HACKSTU001 missing after upsert — DB error?');
  }
  if (matched === 0 && totalUsers > 0) {
    console.warn('[reset-demo-passwords] Most demo IDs still missing — run prisma db seed for full data.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
