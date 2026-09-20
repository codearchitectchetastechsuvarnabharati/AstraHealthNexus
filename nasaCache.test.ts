import test from 'node:test';
import assert from 'node:assert/strict';
import { NasaService } from '../src/services/nasaService.js';

const date = '2024-09-15';
const apod = (day = date) => ({ date: day, title: 'Observation', explanation: 'Astronomy', media_type: 'image', url: 'https://example.org/image.jpg' });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const defaults = { apiKey: () => 'test-key', retryDelayMs: 0 };

test('cache hits preserve retrieval time and expiry is fixed, not extended by reads', async () => {
  let now = Date.parse('2026-09-19T00:00:00Z');
  let calls = 0;
  const service = new NasaService({ ...defaults, now: () => now, cacheMs: 100, fetcher: (async () => { calls++; return json(apod()); }) as typeof fetch });
  const first = await service.get('apod', date);
  now += 99;
  const hit = await service.get('apod', date);
  assert.equal(hit.cacheStatus, 'cached');
  assert.equal(hit.fetchedAt, first.fetchedAt);
  now += 1;
  assert.equal((await service.get('apod', date)).cacheStatus, 'fresh');
  assert.equal(calls, 2);
});

test('endpoint policies expire independently', async () => {
  let now = Date.parse('2026-09-19T00:00:00Z');
  let calls = 0;
  const service = new NasaService({ ...defaults, now: () => now, apodCacheMs: 100, asteroidCacheMs: 10, fetcher: (async url => {
    calls++;
    return json(String(url).includes('/planetary/') ? apod() : { element_count: 0, near_earth_objects: {} });
  }) as typeof fetch });
  await service.get('apod', date);
  await service.get('asteroids', date);
  now += 10;
  assert.equal((await service.get('apod', date)).cacheStatus, 'cached');
  assert.equal((await service.get('asteroids', date)).cacheStatus, 'fresh');
  assert.equal(calls, 3);
});

test('least recently used entries are evicted, keeping frequently requested data', async () => {
  let calls = 0;
  const service = new NasaService({ ...defaults, maxCacheEntries: 2, fetcher: (async url => {
    calls++; return json(apod(new URL(String(url)).searchParams.get('date')!));
  }) as typeof fetch });
  await service.get('apod', '2024-09-15');
  await service.get('apod', '2024-09-16');
  await service.get('apod', '2024-09-15');
  await service.get('apod', '2024-09-17');
  assert.equal((await service.get('apod', '2024-09-15')).cacheStatus, 'cached');
  assert.equal(calls, 3);
  assert.equal((await service.get('apod', '2024-09-16')).cacheStatus, 'fresh');
  assert.equal(calls, 4);
});

test('byte budget evicts entries and oversized cache entries are served without retention', async () => {
  const result = { data: { date, title: 'Observation', explanation: 'Astronomy', mediaType: 'image', url: 'https://example.org/image.jpg', hdUrl: null, thumbnailUrl: null, copyright: null }, source: 'NASA', endpoint: 'apod', date, fetchedAt: new Date().toISOString(), cacheStatus: 'fresh' };
  const bytes = Buffer.byteLength(JSON.stringify(result));
  let calls = 0;
  const fetcher = (async (url: any) => { calls++; return json(apod(new URL(String(url)).searchParams.get('date')!)); }) as typeof fetch;
  const service = new NasaService({ ...defaults, maxCacheBytes: bytes + 1, fetcher });
  await service.get('apod', date);
  await service.get('apod', '2024-09-16');
  assert.equal((await service.get('apod', '2024-09-16')).cacheStatus, 'cached');
  await service.get('apod', date);
  assert.equal(calls, 3);
  const tiny = new NasaService({ ...defaults, maxCacheBytes: 1, fetcher });
  assert.equal((await tiny.get('apod', date)).cacheStatus, 'fresh');
  assert.equal((await tiny.get('apod', date)).cacheStatus, 'fresh');
  assert.equal(calls, 5);
});

test('concurrent expired reads share one refresh and return isolated copies', async () => {
  let now = Date.parse('2026-09-19T00:00:00Z');
  let calls = 0;
  const service = new NasaService({ ...defaults, cacheMs: 10, now: () => now, fetcher: (async () => { calls++; return json(apod()); }) as typeof fetch });
  await service.get('apod', date);
  now += 10;
  const results = await Promise.all(Array.from({ length: 20 }, () => service.get('apod', date)));
  assert.equal(calls, 2);
  (results[0].data as any).title = 'changed';
  assert.equal((results[1].data as any).title, 'Observation');
  assert.equal(((await service.get('apod', date)).data as any).title, 'Observation');
});

test('cache separates keys and dates, and absent credentials never use cached data', async () => {
  let key = 'one';
  let calls = 0;
  const service = new NasaService({ apiKey: () => key, fetcher: (async url => {
    calls++; return json(apod(new URL(String(url)).searchParams.get('date')!));
  }) as typeof fetch });
  await service.get('apod', date);
  key = 'two';
  assert.equal((await service.get('apod', date)).cacheStatus, 'fresh');
  await service.get('apod', '2024-09-16');
  key = '';
  await assert.rejects(service.get('apod', date), { reason: 'configuration' });
  assert.equal(calls, 3);
});

test('stale retention ends at its exact deadline and failures do not replace successful data', async () => {
  let now = Date.parse('2026-09-19T00:00:00Z');
  let calls = 0;
  const service = new NasaService({ ...defaults, cacheMs: 10, staleMs: 50, now: () => now, fetcher: (async () => {
    calls++; return calls === 1 ? json(apod()) : json({}, 503);
  }) as typeof fetch });
  const first = await service.get('apod', date);
  now += 10;
  const stale = await service.get('apod', date);
  assert.equal(stale.cacheStatus, 'stale');
  assert.equal(stale.fetchedAt, first.fetchedAt);
  now += 40;
  await assert.rejects(service.get('apod', date), { reason: 'unavailable' });
});

test('zero freshness bypasses cache hits and invalid configurations fail early', async () => {
  let calls = 0;
  const service = new NasaService({ ...defaults, cacheMs: 0, staleMs: 0, fetcher: (async () => { calls++; return json(apod()); }) as typeof fetch });
  await service.get('apod', date);
  await service.get('apod', date);
  assert.equal(calls, 2);
  for (const option of [{ cacheMs: -1 }, { apodCacheMs: Infinity }, { staleMs: NaN }, { maxCacheEntries: 0 }, { maxCacheBytes: 1.5 }]) {
    assert.throws(() => new NasaService({ ...defaults, ...option }), RangeError);
  }
});
