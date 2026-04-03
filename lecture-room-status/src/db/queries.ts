import type { SQLiteDatabase } from 'expo-sqlite';

export async function getActiveSemesterId(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM semester_config WHERE is_active = 1 LIMIT 1`
  );
  return row?.id ?? null;
}

export async function isCrForActiveSemester(
  db: SQLiteDatabase,
  userId: string
): Promise<boolean> {
  const sem = await getActiveSemesterId(db);
  if (!sem) return false;
  const r = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM cr_assignments WHERE user_id = ? AND semester_id = ? AND is_active = 1`,
    [userId, sem]
  );
  return (r?.c ?? 0) > 0;
}

export async function getCrScope(
  db: SQLiteDatabase,
  userId: string
): Promise<{ department: string; year: number; class_section: string; semester_id: string } | null> {
  const sem = await getActiveSemesterId(db);
  if (!sem) return null;
  const row = await db.getFirstAsync<{
    department: string;
    year: number;
    class_section: string;
    semester_id: string;
  }>(
    `SELECT department, year, class_section, semester_id FROM cr_assignments
     WHERE user_id = ? AND semester_id = ? AND is_active = 1 LIMIT 1`,
    [userId, sem]
  );
  return row ?? null;
}
