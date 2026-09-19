import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { NasaService, NasaError } from '../src/services/nasaService.js';
import { createNasaDataRouter } from '../src/routes/nasaRoutes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { logger } from '../src/middleware/logger.js';

const date = '2024-09-15';
const apod = { date, title: 'Test APOD', explanation: 'An astronomy observation.', media_type: 'image', url: 'https://example.org/post', hdurl: 'https://example.org/image.jpg' };
const asteroid = { id: '123', name: 'Test asteroid', is_potentially_hazardous_asteroid: true, close_approach_data: [{ close_approach_date: date, orbiting_body: 'Earth', miss_distance: { kilometers: '12345.67' } }] };
const feed = { element_count: 1, near_earth_objects: { [date]: [asteroid] } };
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const options = { apiKey: () => 'private-test-key', retryDelayMs: 0 };
const fake = (fn: (...args: any[]) => Promise<Response>) => fn as typeof fetch;

async function serve(t: TestContext, app: express.Express) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test('APOD processing handles image, video and iframe, omits HTML and tolerates optional fields', async () => {
  for (const media_type of ['image', 'video', 'iframe']) {
    const service = new NasaService({ ...options, fetcher: fake(async (url, init) => {
      assert.equal(new URL(url).origin, 'https://api.nasa.gov');
      assert.equal(new URL(url).searchParams.get('date'), date);
      assert.equal(init.redirect, 'error');
      return json({ ...apod, media_type, hdurl: undefined, basic_html: '<script>bad()</script>' });
    }) });
    const result = await service.get('apod', date);
    assert.equal((result.data as any).media_type, media_type);
    assert.equal((result.data as any).hdurl, null);
    assert.equal((result.data as any).basic_html, undefined);
    assert.equal(result.cacheStatus, 'fresh');
  }
});

test('NeoWs summary uses finite kilometre distances, correct counts and null for no approaches', async () => {
  const service = new NasaService({ ...options, fetcher: fake(async url => {
    assert.equal(new URL(url).searchParams.get('end_date'), date);
    return json(feed);
  }) });
  assert.deepEqual((await service.get('asteroids', date)).data, { date, trackedCount: 1, hazardousCount: 1, closestApproach: { id: '123', name: 'Test asteroid', distanceKm: 12345.67 } });
  const empty = new NasaService({ ...options, fetcher: fake(async () => json({ element_count: 0, near_earth_objects: {} })) });
  assert.deepEqual((await empty.get('asteroids', date)).data, { date, trackedCount: 0, hazardousCount: 0, closestApproach: null });
});

test('malformed, wrong-type, mismatched and oversized NASA responses fail without retry', async () => {
  const cases: [string, 'apod' | 'asteroids', () => Response][] = [
    ['bad JSON', 'apod', () => new Response('{bad', { headers: { 'content-type': 'application/json' } })],
    ['HTML', 'apod', () => new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } })],
    ['missing fields', 'apod', () => json({ date })],
    ['wrong type', 'apod', () => json({ ...apod, title: 42 })],
    ['wrong date', 'apod', () => json({ ...apod, date: '2024-09-14' })],
    ['unsafe URL', 'apod', () => json({ ...apod, url: 'javascript:alert(1)' })],
    ['too large', 'apod', () => json({ ...apod, explanation: 'x'.repeat(2 * 1024 * 1024) })],
    ['missing feed', 'asteroids', () => json({})],
    ['wrong count', 'asteroids', () => json({ ...feed, element_count: 2 })],
    ['bad distance', 'asteroids', () => json({ element_count: 1, near_earth_objects: { [date]: [{ ...asteroid, close_approach_data: [{ ...asteroid.close_approach_data[0], miss_distance: { kilometers: 'Infinity' } }] }] } })]
  ];
  for (const [label, endpoint, response] of cases) {
    let calls = 0;
    const service = new NasaService({ ...options, fetcher: fake(async () => { calls++; return response(); }) });
    await assert.rejects(service.get(endpoint, date), (error: any) => error.reason === 'invalid_response', label);
    assert.equal(calls, 1, label);
  }
});

test('transient failures retry once and recover; authentication errors do not retry', async () => {
  for (const kind of ['network', 'server']) {
    let calls = 0;
    const service = new NasaService({ ...options, fetcher: fake(async () => {
      calls++;
      if (calls === 1) { if (kind === 'network') throw new Error('private upstream URL'); return json({}, 500); }
      return json(apod);
    }) });
    assert.equal((await service.get('apod', date)).cacheStatus, 'fresh');
    assert.equal(calls, 2);
  }
  for (const status of [400, 401, 403, 404]) {
    let calls = 0;
    const service = new NasaService({ ...options, fetcher: fake(async () => { calls++; return json({ secret: 'private' }, status); }) });
    await assert.rejects(service.get('apod', date), { status: 502, reason: 'upstream_rejected' });
    assert.equal(calls, 1);
  }
});

test('cache coalesces concurrent requests and isolates caller mutations', async () => {
  let calls = 0;
  const service = new NasaService({ ...options, fetcher: fake(async () => { calls++; return json(apod); }) });
  const results = await Promise.all(Array.from({ length: 10 }, () => service.get('apod', date)));
  assert.equal(calls, 1);
  (results[0].data as any).title = 'changed';
  assert.equal((results[1].data as any).title, apod.title);
  const cached = await service.get('apod', date);
  assert.equal(cached.cacheStatus, 'cached');
  assert.equal((cached.data as any).title, apod.title);
});

test('expired cache falls back explicitly only within stale TTL and cooldown prevents storms', async () => {
  let now = Date.parse('2026-09-20T00:00:00Z');
  let calls = 0;
  const service = new NasaService({ ...options, now: () => now, fetcher: fake(async () => { calls++; return calls === 1 ? json(apod) : json({}, 503); }) });
  const fresh = await service.get('apod', date);
  now += 300000;
  const stale = await service.get('apod', date);
  assert.equal(stale.cacheStatus, 'stale');
  assert.equal(stale.fetchedAt, fresh.fetchedAt);
  assert.ok(stale.warning);
  assert.equal(calls, 3);
  await service.get('apod', date);
  assert.equal(calls, 3);
  now += 3600000;
  await assert.rejects(service.get('apod', date), { reason: 'unavailable' });
});

test('429 respects Retry-After across NASA endpoints without immediate retry', async () => {
  let now = Date.parse('2026-09-20T00:00:00Z');
  let calls = 0;
  const service = new NasaService({ ...options, now: () => now, fetcher: fake(async () => { calls++; return calls === 1 ? json({}, 429, { 'retry-after': '120' }) : json(feed); }) });
  await assert.rejects(service.get('apod', date), { reason: 'rate_limit', retryAfterSeconds: 120 });
  await assert.rejects(service.get('asteroids', date), { reason: 'rate_limit' });
  assert.equal(calls, 1);
  now += 120000;
  assert.equal((await service.get('asteroids', date)).cacheStatus, 'fresh');
});

test('timeout covers slow headers and response bodies using real local HTTP connections', async t => {
  const upstream = express();
  upstream.get('/headers', (_req, _res) => {});
  upstream.get('/body', (_req, res) => { res.setHeader('content-type', 'application/json'); res.write('{'); });
  const base = await serve(t, upstream);
  for (const resource of ['/headers', '/body']) {
    let calls = 0;
    const service = new NasaService({ ...options, timeoutMs: 50, fetcher: fake(async (_url, init) => { calls++; return fetch(base + resource, init); }) });
    await assert.rejects(service.get('apod', date), { status: 504, reason: 'timeout' });
    assert.equal(calls, 2);
  }
});

test('HTTP routes validate requests and safely report missing keys, rate limits and failures', async t => {
  let calls = 0;
  const service = new NasaService({ ...options, fetcher: fake(async () => { calls++; return json(apod); }) });
  const app = express();
  app.use('/api', createNasaDataRouter(service));
  app.use(errorHandler);
  const base = await serve(t, app);
  for (const query of ['date=bad', 'date=2024-02-30', 'date=2999-01-01', 'date=1990-01-01', 'date=2024-09-15&date=2024-09-16', 'api_key=secret', 'unknown=1']) {
    assert.equal((await fetch(`${base}/api/nasa/apod?${query}`)).status, 400, query);
  }
  assert.equal(calls, 0);
  const success = await fetch(`${base}/api/nasa/apod?date=${date}`);
  assert.equal(success.status, 200);
  assert.equal((await success.json()).data.title, apod.title);
  const absent = express();
  absent.use('/api', createNasaDataRouter(new NasaService({ apiKey: () => '' })));
  absent.use(errorHandler);
  const absentBase = await serve(t, absent);
  const response = await fetch(`${absentBase}/api/nasa/apod?date=${date}`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'error', message: 'Internal server error' });
  const limited = express();
  limited.use('/api', createNasaDataRouter(new NasaService({ ...options, fetcher: fake(async () => json({}, 429, { 'retry-after': '120' })) })));
  limited.use(errorHandler);
  const limitedBase = await serve(t, limited);
  const rate = await fetch(`${limitedBase}/api/nasa/apod?date=${date}`);
  assert.equal(rate.status, 503);
  assert.equal(rate.headers.get('retry-after'), '120');
});

test('failure logs never expose API keys or raw upstream messages', async t => {
  const logs: unknown[] = [];
  t.mock.method(logger, 'info', (...args: unknown[]) => { logs.push(args); return logger; });
  const service = new NasaService({ ...options, fetcher: fake(async () => { throw new Error('https://api.nasa.gov/?api_key=private-test-key'); }) });
  await assert.rejects(service.get('apod', date), NasaError);
  assert.ok(JSON.stringify(logs).includes('nasa_request_failed'));
  assert.ok(!JSON.stringify(logs).includes('private-test-key'));
  assert.ok(!JSON.stringify(logs).includes('api_key'));
});
