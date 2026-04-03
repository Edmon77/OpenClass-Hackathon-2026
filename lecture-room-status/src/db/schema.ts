export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS semester_config (
  id TEXT PRIMARY KEY,
  semester_name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  student_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
  department TEXT,
  year INTEGER,
  class_section TEXT,
  force_password_change INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS cr_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  department TEXT NOT NULL,
  year INTEGER NOT NULL,
  class_section TEXT NOT NULL,
  semester_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (semester_id) REFERENCES semester_config(id)
);

CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  building_name TEXT NOT NULL,
  floor_count INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  room_number TEXT NOT NULL,
  building_id TEXT NOT NULL,
  floor_index INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  equipment_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (building_id, room_number),
  FOREIGN KEY (building_id) REFERENCES buildings(id)
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  course_code TEXT,
  course_name TEXT NOT NULL,
  department TEXT NOT NULL,
  year INTEGER NOT NULL,
  class_section TEXT NOT NULL,
  semester_id TEXT NOT NULL,
  teacher_user_id TEXT NOT NULL,
  teacher_contact TEXT,
  created_by_cr_user_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (semester_id) REFERENCES semester_config(id),
  FOREIGN KEY (teacher_user_id) REFERENCES users(id),
  FOREIGN KEY (created_by_cr_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  teacher_user_id TEXT,
  cr_user_id TEXT,
  department TEXT,
  year INTEGER,
  class_section TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('booked','cancelled')),
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS room_alert_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  notify_before_minutes INTEGER NOT NULL DEFAULT 10,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','triggered','expired','cancelled')),
  notification_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS notifications_log (
  id TEXT PRIMARY KEY,
  target_user_id TEXT,
  type TEXT,
  title TEXT,
  message TEXT,
  scheduled_time TEXT,
  delivered_at TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_bookings_room_time ON bookings(room_id, start_time);
CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building_id);
`;
