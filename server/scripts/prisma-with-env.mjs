/**
 * Loads env for Prisma CLI: `server/.env` overrides repo root `.env`.
 * If DATABASE_URL is still unset, builds it from root POSTGRES_PASSWORD (same defaults as docker-compose).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const serverDir = dirname(dirname(fileURLToPath(import.meta.url)));
const rootDir = dirname(serverDir);

config({ path: join(rootDir, '.env') });
config({ path: join(serverDir, '.env'), override: true });

if (!process.env.DATABASE_URL?.trim() && process.env.POSTGRES_PASSWORD) {
  const user = process.env.POSTGRES_USER ?? 'postgres';
  const db = process.env.POSTGRES_DB ?? 'lecture_room';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const pw = encodeURIComponent(process.env.POSTGRES_PASSWORD);
  process.env.DATABASE_URL = `postgresql://${user}:${pw}@${host}:${port}/${db}`;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    '\nMissing DATABASE_URL. Do one of:\n' +
      '  • cp server/.env.example server/.env   (edit DATABASE_URL)\n' +
      '  • Or set POSTGRES_PASSWORD in repo root .env (and run Postgres on localhost:5432)\n'
  );
  process.exit(1);
}

const code = spawnSync('npx', ['prisma', ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: serverDir,
  env: process.env,
  shell: true,
});
process.exit(code.status ?? 1);
