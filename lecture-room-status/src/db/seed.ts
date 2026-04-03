import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { hashPassword } from '../lib/password';

async function insertUser(
  db: SQLiteDatabase,
  row: {
    id: string;
    student_id: string;
    name: string;
    password: string;
    role: 'student' | 'teacher' | 'admin';
    department?: string | null;
    year?: number | null;
    class_section?: string | null;
    force_password_change?: number;
  }
) {
  const ph = await hashPassword(row.password);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO users (id, student_id, name, email, password_hash, role, department, year, class_section, force_password_change, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      row.id,
      row.student_id,
      row.name,
      null,
      ph,
      row.role,
      row.department ?? null,
      row.year ?? null,
      row.class_section ?? null,
      row.force_password_change ?? 0,
      now,
      now,
    ]
  );
}

export async function seedDatabase(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'seeded'`
  );
  if (row?.value === '1') return;

  const semesterId = 'sem-2026-s1';
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO semester_config (id, semester_name, start_date, end_date, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [semesterId, '2026 Semester 1', '2026-01-01', '2026-06-30']
  );

  await insertUser(db, {
    id: 'user-admin',
    student_id: 'ADMIN001',
    name: 'System Admin',
    password: 'admin123',
    role: 'admin',
    force_password_change: 0,
  });

  await insertUser(db, {
    id: 'user-tch',
    student_id: 'TCH001',
    name: 'Dr. Abebe',
    password: 'teacher123',
    role: 'teacher',
    department: 'Software Engineering',
    force_password_change: 0,
  });

  await insertUser(db, {
    id: 'user-stu',
    student_id: 'STU001',
    name: 'Eden Student',
    password: '123456',
    role: 'student',
    department: 'Software Engineering',
    year: 5,
    class_section: 'A',
    force_password_change: 1,
  });

  await insertUser(db, {
    id: 'user-cr',
    student_id: 'CR001',
    name: 'Class Rep',
    password: '123456',
    role: 'student',
    department: 'Software Engineering',
    year: 5,
    class_section: 'A',
    force_password_change: 1,
  });

  await db.runAsync(
    `INSERT INTO cr_assignments (id, user_id, department, year, class_section, semester_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    ['cr-1', 'user-cr', 'Software Engineering', 5, 'A', semesterId]
  );

  await db.runAsync(
    `INSERT INTO buildings (id, building_name, floor_count, is_active) VALUES (?, ?, ?, 1)`,
    ['bld-gion', 'Gion Building', 5]
  );
  await db.runAsync(
    `INSERT INTO buildings (id, building_name, floor_count, is_active) VALUES (?, ?, ?, 1)`,
    ['bld-eng', 'Engineering Block', 4]
  );

  const rooms: Array<[string, string, string, number, number, string]> = [
    ['room-g101', 'G-101', 'bld-gion', 0, 60, '["Internet","Projector","AC"]'],
    ['room-g201', 'G-201', 'bld-gion', 1, 50, '["Internet","Projector"]'],
    ['room-g202', 'G-202', 'bld-gion', 1, 50, '["Internet"]'],
    ['room-g301', 'G-301', 'bld-gion', 2, 40, '["Internet","AC"]'],
    ['room-g401', 'G-401', 'bld-gion', 3, 45, '["Internet"]'],
    ['room-e101', 'E-101', 'bld-eng', 0, 80, '["Projector","AC"]'],
    ['room-e201', 'E-201', 'bld-eng', 1, 70, '["Internet","Projector","AC"]'],
  ];

  for (const [id, num, bid, floor, cap, eq] of rooms) {
    await db.runAsync(
      `INSERT INTO rooms (id, room_number, building_id, floor_index, capacity, equipment_json, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, num, bid, floor, cap, eq]
    );
  }

  const courseId = 'course-db-1';
  await db.runAsync(
    `INSERT INTO courses (id, course_code, course_name, department, year, class_section, semester_id, teacher_user_id, teacher_contact, created_by_cr_user_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      courseId,
      'CSE501',
      'Database Systems',
      'Software Engineering',
      5,
      'A',
      semesterId,
      'user-tch',
      '+251900000000',
      'user-cr',
    ]
  );

  const t1 = new Date();
  t1.setHours(t1.getHours() + 2, 0, 0, 0);
  const t2 = new Date(t1);
  t2.setHours(t2.getHours() + 2);

  const bookingId = await Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO bookings (id, room_id, course_id, teacher_user_id, cr_user_id, department, year, class_section, start_time, end_time, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked', ?, ?)`,
    [
      bookingId,
      'room-g201',
      courseId,
      'user-tch',
      null,
      'Software Engineering',
      5,
      'A',
      t1.toISOString(),
      t2.toISOString(),
      now,
      now,
    ]
  );

  await db.runAsync(
    `INSERT INTO app_meta (key, value) VALUES ('seeded', '1')`
  );
}
