import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { seedMissions, seedTelemetry, seedAlerts } from './seedData.js';

export function assertSeedEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (!['development', 'test'].includes(env.NODE_ENV ?? '') || env.ALLOW_DATABASE_SEED !== 'true') {
    throw new Error('Seeding requires NODE_ENV=development or test and ALLOW_DATABASE_SEED=true');
  }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
}
export async function seedDatabase(client: PrismaClient) {
  assertSeedEnvironment();
  return client.$transaction(async tx => {
    // Serialize simultaneous seed runs; use a seed-specific transaction-scoped lock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(3737001)`;
    for (const mission of seedMissions) await tx.mission.upsert({ where: { id: mission.id }, create: mission, update: {} });
    for (const record of seedTelemetry) await tx.missionTelemetry.upsert({ where: { id: record.id! }, create: record, update: record });
    for (const alert of seedAlerts) await tx.alertEvent.upsert({ where: { id: alert.id }, create: alert, update: alert });
    return { missions: seedMissions.length, telemetry: seedTelemetry.length, alerts: seedAlerts.length };
  }, { timeout: 30000, maxWait: 10000 });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
  let client: PrismaClient | undefined;
  try {
    assertSeedEnvironment();
    client = new PrismaClient();
    console.log(JSON.stringify({ event: 'database_seed_completed', ...await seedDatabase(client) }));
  } catch {
    console.error('Database seed failed. Check development/test opt-in, database configuration and applied migrations.');
    process.exitCode = 1;
  } finally { await client?.$disconnect(); }
}
