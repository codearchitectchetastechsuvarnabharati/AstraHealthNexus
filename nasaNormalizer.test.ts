import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNasaData } from '../src/services/nasaNormalizer.js';
import { NasaService } from '../src/services/nasaService.js';

const date = '2024-09-15';
const apod = { date, title: 'Example', explanation: 'Observation', media_type: 'image', url: 'https://example.org/image' };
const object = (id: string, distance = '1200.50', body = 'Earth') => ({
  id, name: `Asteroid ${id}`, is_potentially_hazardous_asteroid: true,
  close_approach_data: [{ close_approach_date: date, orbiting_body: body, miss_distance: { kilometers: distance } }]
});
const feed = (objects: unknown[]) => ({ element_count: objects.length, near_earth_objects: { [date]: objects } });

test('APOD maps provider fields explicitly and consistently normalizes missing values', () => {
  for (const mediaType of ['image', 'video', 'iframe']) {
    const actual = normalizeNasaData('apod', { ...apod, media_type: mediaType, basic_html: '<script/>', secret: 'ignored' }, date);
    assert.deepEqual(actual, { date, title: 'Example', explanation: 'Observation', mediaType, url: apod.url, hdUrl: null, thumbnailUrl: null, copyright: null });
    assert.equal('media_type' in actual, false);
  }
  const actual = normalizeNasaData('apod', { ...apod, hdurl: 'https://example.org/hd', thumbnail_url: 'https://example.org/thumb', copyright: 'Author' }, date);
  assert.equal(actual.hdUrl, 'https://example.org/hd');
  assert.equal(actual.thumbnailUrl, 'https://example.org/thumb');
  assert.equal(actual.copyright, 'Author');
});

test('asteroid conversion uses numeric kilometres and deterministic ordering', () => {
  const a = object('a');
  const b = object('b');
  const mars = object('c', '1', 'Mars');
  const actual = normalizeNasaData('asteroids', feed([b, mars, a]), date);
  assert.deepEqual(actual, { date, trackedCount: 3, hazardousCount: 3, closestApproach: { id: 'a', name: 'Asteroid a', distanceKm: 1200.5 } });
  assert.deepEqual(normalizeNasaData('asteroids', feed([a, mars, b]), date), actual);
  assert.equal(normalizeNasaData('asteroids', feed([mars]), date).closestApproach, null);
  assert.deepEqual(normalizeNasaData('asteroids', feed([]), date), { date, trackedCount: 0, hazardousCount: 0, closestApproach: null });
});

test('normalization rejects inconsistent or wrongly typed source data', () => {
  for (const payload of [{ ...apod, date: '2024-09-14' }, { ...apod, date: '2024-02-30' }, { ...apod, title: 42 }, { ...apod, url: 'javascript:alert(1)' }]) {
    assert.throws(() => normalizeNasaData('apod', payload, date));
  }
  for (const payload of [feed([object('a', 'Infinity')]), feed([object('a', '-1')]), feed([object('a'), object('a')]), { ...feed([]), element_count: 1 }, feed([{ ...object('a'), is_potentially_hazardous_asteroid: 'false' }])]) {
    assert.throws(() => normalizeNasaData('asteroids', payload, date));
  }
});

test('fresh, cached and stale results all expose the same normalized internal data', async () => {
  let now = Date.parse('2026-09-19T00:00:00Z');
  let calls = 0;
  const service = new NasaService({ apiKey: () => 'test', now: () => now, cacheMs: 10, staleMs: 100, retryDelayMs: 0, fetcher: (async () => {
    calls++;
    return new Response(JSON.stringify(calls === 1 ? apod : {}), { status: calls === 1 ? 200 : 503, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch });
  const fresh = await service.get('apod', date);
  const cached = await service.get('apod', date);
  now += 10;
  const stale = await service.get('apod', date);
  assert.equal(fresh.cacheStatus, 'fresh');
  assert.equal(cached.cacheStatus, 'cached');
  assert.equal(stale.cacheStatus, 'stale');
  assert.deepEqual(fresh.data, normalizeNasaData('apod', apod, date));
  assert.deepEqual(cached.data, fresh.data);
  assert.deepEqual(stale.data, fresh.data);
  assert.equal(stale.fetchedAt, fresh.fetchedAt);
});
