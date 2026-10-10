import test from 'node:test';
import assert from 'node:assert/strict';
import { seedMissions, seedTelemetry, seedAlerts } from '../prisma/seedData.js';
import { assertSeedEnvironment } from '../prisma/seed.js';
import { IncomingTelemetryRecordSchema } from '../src/schemas.js';

test('seed fixtures cover entities, sources, origins and valid telemetry intake', () => {
  assert.equal(seedTelemetry.length, 36);
  assert.equal(new Set(seedTelemetry.map(r => r.id)).size, 36);
  assert.equal(new Set(seedTelemetry.map(r => r.source)).size, 6);
  assert.deepEqual(new Set(seedTelemetry.map(r => r.origin)), new Set(['collected', 'submitted']));
  for (const record of seedTelemetry) {
    assert.ok(seedMissions.some(m => m.id === record.mission));
    assert.ok(IncomingTelemetryRecordSchema.safeParse({ timestamp: (record.timestamp as Date).toISOString(), source: record.source, category: record.category, mission: record.mission, values: record.values }).success);
  }
  assert.deepEqual(new Set(seedAlerts.map(a => a.status)), new Set(['open', 'acknowledged', 'resolved']));
  assert.equal(new Set(seedAlerts.map(a => a.id)).size, 4);
  for (const alert of seedAlerts) assert.match(alert.id, /^alert_[a-f0-9]{64}$/);
});

test('seeding rejects production, missing opt-in and absent database URL', () => {
  for (const env of [{ NODE_ENV: 'production', ALLOW_DATABASE_SEED: 'true', DATABASE_URL: 'test' }, { NODE_ENV: 'test', DATABASE_URL: 'test' }, { NODE_ENV: 'test', ALLOW_DATABASE_SEED: 'true' }]) assert.throws(() => assertSeedEnvironment(env));
  assert.doesNotThrow(() => assertSeedEnvironment({ NODE_ENV: 'test', ALLOW_DATABASE_SEED: 'true', DATABASE_URL: 'test' }));
});
