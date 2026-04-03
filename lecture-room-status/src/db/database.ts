import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';
import { seedDatabase } from './seed';

let singleton: SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (singleton) return singleton;
  const db = await openDatabaseAsync('lecture_room.db');
  await db.execAsync(SCHEMA_SQL);
  await seedDatabase(db);
  singleton = db;
  return db;
}
