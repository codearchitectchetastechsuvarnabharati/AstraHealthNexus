// Invoked only by the isolated migration validator, never by the regular test suite.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { seedDatabase, assertSeedEnvironment } from './seed.js';
import { seedAlerts, seedTelemetry } from './seedData.js';
assertSeedEnvironment();
const db = new PrismaClient();
try {
  await db.mission.create({ data: { id: 'unrelated_test_mission' } });
  assert.deepEqual(await seedDatabase(db), { missions: 2, telemetry: 36, alerts: 4 });
  const first = await db.missionTelemetry.findMany({ orderBy: { id: 'asc' } });
  await Promise.all([seedDatabase(db), seedDatabase(db)]);
  assert.deepEqual(await db.missionTelemetry.findMany({ orderBy: { id: 'asc' } }), first);
  assert.equal(await db.mission.count(), 3);
  assert.equal(await db.alertEvent.count(), 4);
  const open = seedAlerts[0];
  await db.alertEvent.update({ where: { id: open.id }, data: { status: 'acknowledged', acknowledgedAt: new Date('2026-01-01T00:01:00Z'), updatedAt: new Date('2026-01-01T00:01:00Z') } });
  await db.alertEvent.update({ where: { id: open.id }, data: { status: 'resolved', resolvedAt: new Date('2026-01-01T00:02:00Z'), updatedAt: new Date('2026-01-01T00:02:00Z') } });
  await seedDatabase(db);
  assert.equal((await db.alertEvent.findUniqueOrThrow({ where: { id: open.id } })).status, 'open');
  const records = await db.missionTelemetry.findMany({ where: { mission: 'seed_demo_orbit', source: 'iss' }, orderBy: [{ timestamp: 'desc' }, { id: 'asc' }], take: 2 });
  assert.equal(records.length, 2);
  assert.ok(records[0].timestamp >= records[1].timestamp);
  // Force a late failure and verify preceding upserts are rolled back.
  await db.missionTelemetry.update({ where: { id: seedTelemetry[0].id }, data: { values: { preserved: true } } });
  await db.$executeRawUnsafe(`ALTER TABLE "AlertEvent" ADD CONSTRAINT "seed_rollback_test" CHECK ("message" <> 'Demo cabin pressure requires review') NOT VALID`);
  try { await assert.rejects(seedDatabase(db)); }
  finally { await db.$executeRawUnsafe('ALTER TABLE "AlertEvent" DROP CONSTRAINT "seed_rollback_test"'); }
  assert.deepEqual((await db.missionTelemetry.findUniqueOrThrow({ where: { id: seedTelemetry[0].id } })).values, { preserved: true });
  await seedDatabase(db);
  console.log('PASS: seeds, concurrent reruns, unrelated data preservation, lifecycle, filtered reads and transaction rollback');
} finally { await db.$disconnect(); }
