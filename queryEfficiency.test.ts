import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { TelemetryRecordStore } from '../src/services/telemetryRecordsService.js';
import { DatasetService } from '../src/services/datasetService.js';
import { startTelemetryIngestion } from '../src/services/ingestionService.js';

const record = (i: number, mission = 'missionA') => ({ timestamp: new Date(Date.UTC(2026, 0, 1) + (i % 5) * 1000).toISOString(), mission, source: 'iss', category: 'orbit', values: { latitude: i % 90, longitude: 0, altitude: 400, velocity: 27000 } });

test('optimized telemetry query preserves filters, exact counts, tie order and retention', () => {
  const store = new TelemetryRecordStore();
  const input = Array.from({ length: 1300 }, (_, i) => record(i, i % 2 ? 'missionA' : 'missionB'));
  for (let i = 0; i < input.length; i += 100) store.ingest({ records: input.slice(i, i + 100) });
  const retained = input.slice(-1200);
  for (const offset of [0, 10, 1000]) {
    const since = '2026-01-01T00:00:01.000Z';
    const until = '2026-01-01T00:00:03.000Z';
    const expected = retained.filter(r => r.mission === 'missionA' && r.timestamp >= since && r.timestamp <= until).reverse().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const result = store.query({ limit: 7, offset, mission: 'missionA', source: 'iss', category: 'orbit', since, until });
    assert.deepEqual(result.data.map(({ receivedAt, origin, ...r }) => r), expected.slice(offset, offset + 7));
    assert.equal(result.pagination.total, expected.length);
    assert.equal(result.retention.retainedRecords, 1200);
    assert.equal(result.retention.oldestTimestamp, '2026-01-01T00:00:00.000Z');
    assert.equal(result.retention.newestTimestamp, '2026-01-01T00:00:04.000Z');
  }
});

test('repeated reads reuse timestamp ordering and writes invalidate it', t => {
  const store = new TelemetryRecordStore();
  store.ingest({ records: [record(1), record(2)] });
  const parse = t.mock.method(Date, 'parse');
  const first = store.query({ limit: 10, offset: 0 });
  const calls = parse.mock.callCount();
  assert.equal(calls, 2);
  first.data[0].values.altitude = -1;
  const repeated = store.query({ limit: 10, offset: 0 });
  assert.equal(parse.mock.callCount(), calls);
  assert.equal(repeated.data[0].values.altitude, 400);
  store.ingest({ records: [record(3)] });
  assert.equal(store.query({ limit: 10, offset: 0 }).pagination.total, 3);
});

test('invalid batches do not invalidate valid query results', () => {
  const store = new TelemetryRecordStore();
  store.ingest({ records: [record(1)] });
  const before = store.query({ limit: 10, offset: 0 });
  assert.throws(() => store.ingest({ records: [{ bad: true }] }));
  assert.deepEqual(store.query({ limit: 10, offset: 0 }), before);
  assert.equal(store.query({ limit: 10, offset: 0, source: 'rocket' }).pagination.total, 0);
});

test('slow ingestion skips overlapping interval ticks', async t => {
  const old = process.env.INGESTION_INTERVAL_MS;
  process.env.INGESTION_INTERVAL_MS = '5';
  let calls = 0;
  t.mock.method(DatasetService, 'getISSData', () => { calls++; return new Promise(() => {}); });
  const stop = startTelemetryIngestion();
  try {
    await delay(60);
    assert.equal(calls, 1);
  } finally {
    stop();
    if (old === undefined) delete process.env.INGESTION_INTERVAL_MS;
    else process.env.INGESTION_INTERVAL_MS = old;
  }
});
