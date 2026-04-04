/**
 * Idempotent campus rows (buildings + rooms + academic year) without tsx.
 * Runs when prisma db seed’s TS step fails — fixes empty Explore after login.
 */
import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const BUILDINGS = [
  { id: '00000000-0000-0000-0000-0000000000b1', name: 'Gion Building', floorCount: 5 },
  { id: '00000000-0000-0000-0000-0000000000b2', name: 'Korya Laboratory', floorCount: 2 },
  { id: '00000000-0000-0000-0000-0000000000b3', name: 'Kehas Hall', floorCount: 1 },
  { id: '00000000-0000-0000-0000-0000000000b4', name: 'Tedros Hall', floorCount: 1 },
  { id: '00000000-0000-0000-0000-0000000000b5', name: 'Engineering Workshop Block', floorCount: 3 },
  { id: '00000000-0000-0000-0000-0000000000b6', name: 'BIT Innovation Annex', floorCount: 4 },
];

/** @type {{ id: string; num: string; buildingId: string; floor: number; cap: number; type: string; projector?: boolean; net?: boolean; equipment?: string[] }[]} */
const ROOMS = [
  ['00000000-0000-0000-0000-0000000000b1', '20000000-0000-4000-8000-000000000101', 'G-101', 0, 120, 'lecture_hall', true, true, ['Projector', 'PA', 'Wi-Fi']],
  ['00000000-0000-0000-0000-0000000000b1', '20000000-0000-4000-8000-000000000102', 'G-102', 0, 90, 'lecture_hall', true, true],
  ['00000000-0000-0000-0000-0000000000b1', '20000000-0000-4000-8000-000000000201', 'G-201', 1, 60, 'seminar', true, true],
  ['00000000-0000-0000-0000-0000000000b1', '20000000-0000-4000-8000-000000000202', 'G-202', 1, 50, 'lecture_hall', true, true],
  ['00000000-0000-0000-0000-0000000000b1', '20000000-0000-4000-8000-000000000301', 'G-301', 2, 45, 'office', false, true],
  ['00000000-0000-0000-0000-0000000000b1', '20000000-0000-4000-8000-000000000401', 'G-401', 3, 70, 'lecture_hall', true, true],
  ['00000000-0000-0000-0000-0000000000b2', '20000000-0000-4000-8000-000000000501', 'Korya Lab', 0, 40, 'lab', true, true, ['Workstations', 'Linux lab image']],
  ['00000000-0000-0000-0000-0000000000b2', '20000000-0000-4000-8000-000000000502', 'Audio Visual Lab', 0, 35, 'lab', true, true, ['AV rack', 'Recording kit']],
  ['00000000-0000-0000-0000-0000000000b2', '20000000-0000-4000-8000-000000000503', 'K-201', 1, 30, 'lab', false, true],
  ['00000000-0000-0000-0000-0000000000b3', '20000000-0000-4000-8000-000000000601', 'KEH-G1', 0, 280, 'lecture_hall', true, true, ['Large hall', 'Dual projectors']],
  ['00000000-0000-0000-0000-0000000000b3', '20000000-0000-4000-8000-000000000602', 'KEH-G2', 0, 200, 'lecture_hall', true, true],
  ['00000000-0000-0000-0000-0000000000b4', '20000000-0000-4000-8000-000000000701', 'TED-G1', 0, 220, 'lecture_hall', true, true],
  ['00000000-0000-0000-0000-0000000000b4', '20000000-0000-4000-8000-000000000702', 'TED-G2', 0, 160, 'seminar', true, true],
  ['00000000-0000-0000-0000-0000000000b5', '20000000-0000-4000-8000-000000000801', 'EW-101', 0, 25, 'lab', false, true, ['3D printers', 'Bench tools']],
  ['00000000-0000-0000-0000-0000000000b5', '20000000-0000-4000-8000-000000000802', 'EW-201', 1, 50, 'lecture_hall', true, true],
  ['00000000-0000-0000-0000-0000000000b6', '20000000-0000-4000-8000-000000000901', 'ANN-301', 2, 80, 'lecture_hall', true, true],
  ['00000000-0000-0000-0000-0000000000b6', '20000000-0000-4000-8000-000000000902', 'ANN-302', 2, 40, 'seminar', true, true],
].map((row) => {
  const [buildingId, id, num, floor, cap, type, projector, net, equipment] = row;
  return {
    buildingId,
    id,
    num,
    floor,
    cap,
    type,
    projector,
    net,
    equipment,
  };
});

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[ensure-demo-campus] Missing DATABASE_URL.');
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

  for (const b of BUILDINGS) {
    await prisma.building.upsert({
      where: { id: b.id },
      create: { id: b.id, name: b.name, floorCount: b.floorCount },
      update: { name: b.name, floorCount: b.floorCount, isActive: true },
    });
  }

  for (const r of ROOMS) {
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
        isActive: true,
      },
      update: {
        roomNumber: r.num,
        buildingId: r.buildingId,
        floorIndex: r.floor,
        capacity: r.cap,
        roomType: r.type,
        hasProjector: r.projector ?? false,
        hasInternet: r.net ?? true,
        equipmentJson: r.equipment ? JSON.stringify(r.equipment) : null,
        isActive: true,
      },
    });
  }

  const bc = await prisma.building.count({ where: { isActive: true } });
  const rc = await prisma.room.count({ where: { isActive: true } });
  console.log(`[ensure-demo-campus] OK — ${bc} buildings, ${rc} active rooms (demo BiT campus).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
