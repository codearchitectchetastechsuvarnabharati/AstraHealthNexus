import { authenticatedFetch as fetch } from './authTestSupport.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { DatasetService } from '../src/services/datasetService.js';
import { DatasetLoader } from '../src/services/datasetLoader.js';
import { TelemetryRecordStore, TELEMETRY_RETENTION, telemetryRecords } from '../src/services/telemetryRecordsService.js';
import { collectTelemetrySnapshot } from '../src/services/ingestionService.js';

async function serve() {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

test('catalog reports canonical datasets, accurate counts, source and update provenance', async () => {
  const catalog = await DatasetService.getCatalog();
  assert.equal(catalog.length, 6);
  assert.ok(catalog.every(item => item.available));
  const metadata = await DatasetService.getMetadata('astronauts');
  assert.equal(metadata.recordCount, (await DatasetService.getAstronautData()).length);
  assert.equal(metadata.source.type, 'local-json');
  assert.equal(metadata.source.filename, 'astronauts.json');
  assert.equal(metadata.source.upstreamUrl, null);
  assert.ok(Number.isFinite(Date.parse(metadata.updates.fileUpdatedAt)));
  assert.ok(metadata.fields.includes('vitalSigns'));
  assert.equal((await DatasetService.getMetadata('mission')).recordCount, 1);
  assert.equal((await DatasetService.getMetadata('mission')).updates.dataUpdatedAt, null);
});

test('catalog and metadata routes paginate, resolve aliases and validate queries', async () => {
  const server = await serve();
  try {
    const catalog = await (await fetch(server.url + '/api/dataset/catalog?limit=2&offset=1')).json();
    assert.equal(catalog.data.length, 2);
    assert.equal(catalog.pagination.total, 6);
    const metadata = await (await fetch(server.url + '/api/dataset/weather/metadata')).json();
    assert.equal(metadata.data.key, 'spaceWeather');
    for (const path of ['/dataset/catalog?limit=101', '/dataset/bogus/metadata', '/dataset/iss/metadata?limit=1']) {
      assert.equal((await fetch(server.url + '/api' + path)).status, 400);
    }
  } finally { await server.close(); }
});

test('telemetry records combine filters before pagination, include range boundaries, and isolate results', async () => {
  const store = new TelemetryRecordStore();
  const bundle = await DatasetService.getAllData();
  store.record(bundle, '2026-01-01T00:00:00Z');
  store.record({ ...bundle, mission: { ...bundle.mission, missionId: 'SECOND' } }, '2026-01-02T00:00:00Z');
  store.record(bundle, '2026-01-03T00:00:00Z');
  const query = { limit: 1, offset: 0, source: 'iss' as const, category: 'orbit' as const, mission: bundle.mission.missionId, since: '2026-01-01T00:00:00Z', until: '2026-01-03T00:00:00Z' };
  const result = store.query(query);
  assert.equal(result.pagination.total, 2);
  assert.equal(result.pagination.hasMore, true);
  assert.equal(result.data[0].timestamp, '2026-01-03T00:00:00Z');
  result.data[0].values.altitude = -1;
  assert.equal(store.query(query).data[0].values.altitude, bundle.iss.altitude);
  assert.equal(store.query({ ...query, offset: 1 }).data[0].timestamp, '2026-01-01T00:00:00Z');
  assert.equal(store.query({ ...query, category: 'crew' }).pagination.total, 0);
  assert.equal(store.query({ ...query, mission: 'UNKNOWN' }).pagination.total, 0);
});

test('telemetry retention stays bounded and reports the available window', async () => {
  const store = new TelemetryRecordStore();
  const bundle = await DatasetService.getAllData();
  for (let i = 0; i < 205; i++) store.record(bundle, new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString());
  const result = store.query({ limit: 100, offset: 0 });
  assert.equal(result.pagination.total, TELEMETRY_RETENTION);
  assert.equal(result.data.length, 100);
  assert.equal(result.retention.oldestTimestamp, '2026-01-01T00:00:05.000Z');
});

test('records API reads retained telemetry without collecting new samples; options expose supported filters', async () => {
  await collectTelemetrySnapshot();
  const server = await serve();
  try {
    const before = telemetryRecords.query({ limit: 1, offset: 0 }).retention.retainedRecords;
    const response = await fetch(server.url + '/api/telemetry/records?source=iss&category=orbit');
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(result.data.length > 0);
    assert.ok(result.data.every((item: any) => item.source === 'iss' && item.category === 'orbit'));
    assert.equal(telemetryRecords.query({ limit: 1, offset: 0 }).retention.retainedRecords, before);
    const options = await (await fetch(server.url + '/api/telemetry/options')).json();
    assert.ok(options.sources.includes('iss'));
    assert.ok(options.missions.includes(result.data[0].mission));
    for (const query of ['since=bad', 'since=2026-02-01T00:00:00Z&until=2026-01-01T00:00:00Z', 'source=unknown', 'category=unknown', 'source=iss&source=nasa', 'mission=', 'source[]=iss', 'limit=101']) {
      assert.equal((await fetch(server.url + '/api/telemetry/records?' + query)).status, 400, query);
    }
  } finally { await server.close(); }
});

test('malformed datasets are unavailable in catalog and rejected during ingestion without adding records', async (t) => {
  DatasetLoader.clearCache();
  const readFile = DatasetLoader.storage.readFile;
  const mock = t.mock.method(DatasetLoader.storage, 'readFile', async (...args: any[]) => {
    if (String(args[0]).endsWith('iss.json')) return '{"name":"ISS","latitude":"invalid"}';
    return (readFile as any)(...args);
  });
  const before = telemetryRecords.query({ limit: 1, offset: 0 }).retention.retainedRecords;
  try {
    const catalog = await DatasetService.getCatalog();
    assert.equal(catalog.find(item => item.key === 'iss')?.available, false);
    assert.equal(catalog.find(item => item.key === 'iss')?.recordCount, null);
    assert.equal(catalog.find(item => item.key === 'mission')?.available, true);
    await assert.rejects(collectTelemetrySnapshot(), /latitude/);
    assert.equal(telemetryRecords.query({ limit: 1, offset: 0 }).retention.retainedRecords, before);
  } finally { mock.mock.restore(); DatasetLoader.clearCache(); }
  await collectTelemetrySnapshot();
  assert.equal((await DatasetService.getMetadata('iss')).available, true);
});
