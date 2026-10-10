import { authenticatedFetch as fetch } from './authTestSupport.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { TelemetryRecordStore, telemetryRecords, TELEMETRY_RETENTION } from '../src/services/telemetryRecordsService.js';
import { logger } from '../src/middleware/logger.js';

const iss = { timestamp: '2026-09-16T12:30:00+05:30', source: 'iss', category: 'orbit', mission: 'INTAKE-TEST', values: { latitude: 10, longitude: 20, altitude: 408, velocity: 27600 } };
const otherRecords = [
  { ...iss, source: 'spaceWeather', category: 'space-weather', values: { kpIndex: 4, solarFlux: 120, solarWindSpeed: 400 } },
  { ...iss, source: 'astronauts', category: 'crew', values: { crewCount: 3, averageHealthScore: 95 } },
  { ...iss, source: 'rocket', category: 'vehicle', values: { healthScore: 90, thrust: 95, fuelPressure: 98 } },
  { ...iss, source: 'nasa', category: 'nasa', values: { hazardousCount: 1, trackedToday: 10 } },
  { ...iss, source: 'mission', category: 'mission', values: { phase: ' Active ', crewCount: 3, objectiveCount: 4 } }
];
async function serve() {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
async function post(url: string, body: unknown) {
  return fetch(url + '/api/telemetry/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('all supported telemetry sources are processed and timestamps normalized', () => {
  const store = new TelemetryRecordStore();
  const result = store.ingest({ records: [iss, ...otherRecords] });
  assert.equal(result.accepted, 6);
  const records = store.query({ limit: 100, offset: 0 }).data;
  assert.equal(records.length, 6);
  assert.ok(records.every(record => record.timestamp === '2026-09-16T07:00:00.000Z' && record.origin === 'submitted' && record.receivedAt === result.receivedAt));
  assert.equal(records.find(record => record.source === 'mission')?.values.phase, 'Active');
});

test('service rejects incomplete, invalid or oversized batches atomically', () => {
  const store = new TelemetryRecordStore();
  store.ingest({ records: [iss] });
  const badRecords = [
    {}, { ...iss, timestamp: 'yesterday' }, { ...iss, source: 'unknown' },
    { ...iss, category: 'crew' }, { ...iss, mission: '' }, { ...iss, extra: 1 },
    { ...iss, values: {} }, { ...iss, values: { ...iss.values, altitude: '408' } },
    { ...iss, values: { ...iss.values, altitude: Infinity } },
    { ...iss, values: { ...iss.values, altitude: NaN } },
    { ...iss, values: { ...iss.values, latitude: 91 } },
    { ...iss, values: { ...iss.values, longitude: -181 } },
    { ...iss, values: { ...iss.values, velocity: -1 } },
    { ...otherRecords[0], values: { kpIndex: 10, solarFlux: 120, solarWindSpeed: 400 } },
    { ...otherRecords[1], values: { crewCount: 1.5, averageHealthScore: 101 } }
  ];
  for (const invalid of badRecords) {
    assert.throws(() => store.ingest({ records: [iss, invalid] }), /Invalid telemetry/);
    assert.equal(store.query({ limit: 100, offset: 0 }).pagination.total, 1);
  }
  for (const body of [undefined, [], {}, { records: [] }, { records: Array(101).fill(iss) }, { records: [iss], extra: true }]) {
    assert.throws(() => store.ingest(body), /Invalid telemetry/);
  }
});

test('out-of-order telemetry sorts by timestamp and reports true retained time range', () => {
  const store = new TelemetryRecordStore();
  store.ingest({ records: [{ ...iss, timestamp: '2026-09-16T12:00:00Z' }, { ...iss, timestamp: '2026-09-16T08:00:00Z' }, { ...iss, timestamp: '2026-09-16T10:00:00Z' }] });
  const result = store.query({ limit: 2, offset: 0, source: 'iss', mission: 'INTAKE-TEST', since: '2026-09-16T09:00:00Z' });
  assert.deepEqual(result.data.map(record => record.timestamp), ['2026-09-16T12:00:00.000Z', '2026-09-16T10:00:00.000Z']);
  assert.equal(result.retention.oldestTimestamp, '2026-09-16T08:00:00.000Z');
  assert.equal(result.retention.newestTimestamp, '2026-09-16T12:00:00.000Z');
});

test('incoming telemetry shares bounded retention and cannot be changed through input references', () => {
  const store = new TelemetryRecordStore();
  const mutable = structuredClone(iss);
  store.ingest({ records: [mutable] }); mutable.values.altitude = -10;
  assert.equal(store.query({ limit: 1, offset: 0 }).data[0].values.altitude, 408);
  for (let i = 0; i < 13; i++) store.ingest({ records: Array(100).fill(iss) });
  assert.equal(store.query({ limit: 100, offset: 0 }).pagination.total, TELEMETRY_RETENTION);
});

test('POST accepts records, logs processing with a request ID and exposes them to GET filters', async (t) => {
  const logs: any[] = [];
  t.mock.method(logger, 'info', (message: string, meta: any) => { logs.push({ message, ...meta }); return logger; });
  const server = await serve();
  try {
    const response = await post(server.url, { records: [iss] });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).accepted, 1);
    assert.ok(logs.some(log => log.message === 'telemetry_batch_processed' && log.requestId === response.headers.get('x-request-id') && log.accepted === 1));
    const found = await (await fetch(server.url + '/api/telemetry/records?mission=INTAKE-TEST&source=iss&category=orbit')).json();
    assert.ok(found.data.some((record: any) => record.timestamp === '2026-09-16T07:00:00.000Z'));
  } finally { await server.close(); }
});

test('HTTP validation rejects malformed JSON, wrong types, missing fields and oversized payloads without writes', async () => {
  const server = await serve();
  const before = telemetryRecords.query({ limit: 1, offset: 0 }).pagination.total;
  try {
    for (const body of [{}, { records: [iss, { ...iss, values: {} }] }, { records: [] }]) {
      const response = await post(server.url, body);
      assert.equal(response.status, 400);
      assert.ok(Array.isArray((await response.json()).issues));
    }
    for (const [body, status] of [['{bad', 400], ['x'.repeat(110000), 413]] as const) {
      const response = await fetch(server.url + '/api/telemetry/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      assert.equal(response.status, status);
    }
    const wrongType = await fetch(server.url + '/api/telemetry/records', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    assert.equal(wrongType.status, 415);
    assert.equal(telemetryRecords.query({ limit: 1, offset: 0 }).pagination.total, before);
  } finally { await server.close(); }
});

test('processing failures return safe errors and the intake API recovers', async (t) => {
  const server = await serve();
  const mock = t.mock.method(telemetryRecords, 'ingest', () => { throw new Error('private processing failure'); });
  try {
    const response = await post(server.url, { records: [iss] });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { status: 'error', message: 'Internal server error' });
    mock.mock.restore();
    assert.equal((await post(server.url, { records: [iss] })).status, 201);
  } finally { mock.mock.restore(); await server.close(); }
});
