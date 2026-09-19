import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AlertService, DEFAULT_ALERT_DEDUP_WINDOW_MS } from '../src/services/alertService.js';
import { logger } from '../src/middleware/logger.js';

const query = { limit: 100, offset: 0 };
const event = { message: 'Crew check', severity: 'warning' };
const snapshot = { summary: 'Snapshot', severity: 'info', events: [event] };
async function setup(t: TestContext, windowMs = 300000) {
  const directory = await mkdtemp(path.join(tmpdir(), 'alert-dedup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let clock = Date.parse('2026-09-20T00:00:00Z');
  const now = () => clock;
  const file = path.join(directory, 'alerts.json');
  const service = new AlertService(file, { dedupWindowMs: windowMs, now });
  return { service, file, now, advance: (ms: number) => { clock += ms; } };
}

test('same-batch and repeated events are suppressed until the exact fixed-window boundary', async t => {
  const { service, file, advance } = await setup(t);
  const first = await service.list({ ...snapshot, events: [event, event, event] }, query);
  assert.equal(first.pagination.total, 1);
  const initialState = await readFile(file, 'utf8');
  advance(299999);
  const repeat = await service.list(snapshot, query);
  assert.deepEqual(repeat.events, first.events);
  assert.equal(await readFile(file, 'utf8'), initialState);
  advance(1);
  const expired = await service.list({ ...snapshot, events: [event, event] }, query);
  assert.equal(expired.pagination.total, 2);
  assert.notEqual(expired.events[0].id, expired.events[1].id);
  assert.equal(expired.events[1].status, 'open');
  assert.equal(expired.events[1].createdAt, '2026-09-20T00:05:00.000Z');
  assert.deepEqual(expired.events[0], first.events[0]);
});

test('different messages and severities are separate identities', async t => {
  const { service } = await setup(t);
  const result = await service.list({ ...snapshot, events: [event, { ...event, message: 'Vehicle check' }, { ...event, severity: 'info' }] }, query);
  assert.equal(result.pagination.total, 3);
  assert.equal(new Set(result.events.map(alert => alert.id)).size, 3);
});

test('acknowledgement and resolution neither reset nor extend suppression', async t => {
  const { service, advance } = await setup(t);
  const first = (await service.list(snapshot, query)).events[0];
  advance(100000);
  const acknowledged = await service.transition(first.id, 'acknowledged');
  assert.deepEqual((await service.list(snapshot, query)).events[0], acknowledged);
  advance(100000);
  const resolved = await service.transition(first.id, 'resolved');
  assert.deepEqual((await service.list(snapshot, query)).events[0], resolved);
  advance(100000);
  const result = await service.list(snapshot, query);
  assert.equal(result.pagination.total, 2);
  assert.deepEqual(result.events[0], resolved);
  assert.equal(result.events[1].status, 'open');
});

test('restart preserves deduplication and accepts legacy lifecycle IDs', async t => {
  const { service, file, now, advance } = await setup(t);
  await service.list(snapshot, query);
  const state = JSON.parse(await readFile(file, 'utf8'));
  state.alerts[0].id = 'alert_' + createHash('sha256').update(JSON.stringify(['dashboard', event.message, event.severity])).digest('hex');
  await writeFile(file, JSON.stringify(state));
  const restarted = new AlertService(file, { dedupWindowMs: 300000, now });
  advance(299999);
  assert.deepEqual((await restarted.list(snapshot, query)).events, state.alerts);
  advance(1);
  assert.equal((await restarted.list(snapshot, query)).pagination.total, 2);
});

test('concurrent requests produce one matching alert per window', async t => {
  const { service, advance } = await setup(t);
  const initial = await Promise.all(Array.from({ length: 12 }, () => service.list(snapshot, query)));
  assert.ok(initial.every(result => result.pagination.total === 1));
  advance(300000);
  const later = await Promise.all(Array.from({ length: 12 }, () => service.list(snapshot, query)));
  assert.ok(later.every(result => result.pagination.total === 2));
});

test('failed persistence does not advance the window and retry creates exactly one alert', async t => {
  const { service, file, advance } = await setup(t);
  await service.list(snapshot, query);
  const before = await readFile(file, 'utf8');
  advance(300000);
  const mock = t.mock.method(service.storage, 'rename', async () => { throw new Error('disk unavailable'); });
  await assert.rejects(service.list(snapshot, query), /disk unavailable/);
  assert.equal(await readFile(file, 'utf8'), before);
  mock.mock.restore();
  assert.equal((await service.list(snapshot, query)).pagination.total, 2);
  assert.equal((await service.list(snapshot, query)).pagination.total, 2);
});

test('custom duration and backward clock changes are handled predictably', async t => {
  const { service, advance } = await setup(t, 1000);
  await service.list(snapshot, query);
  advance(-1000);
  assert.equal((await service.list(snapshot, query)).pagination.total, 1);
  advance(1999);
  assert.equal((await service.list(snapshot, query)).pagination.total, 1);
  advance(1);
  assert.equal((await service.list(snapshot, query)).pagination.total, 2);
});

test('environment configuration is read lazily, validates input and defaults to five minutes', async t => {
  const { file, now, advance } = await setup(t);
  const previous = process.env.ALERT_DEDUP_WINDOW_MS;
  t.after(() => { if (previous === undefined) delete process.env.ALERT_DEDUP_WINDOW_MS; else process.env.ALERT_DEDUP_WINDOW_MS = previous; });
  const service = new AlertService(file, { now });
  delete process.env.ALERT_DEDUP_WINDOW_MS;
  assert.equal(DEFAULT_ALERT_DEDUP_WINDOW_MS, 300000);
  await service.list(snapshot, query);
  advance(1000);
  assert.equal((await service.list(snapshot, query)).pagination.total, 1);
  process.env.ALERT_DEDUP_WINDOW_MS = '1000';
  assert.equal((await service.list(snapshot, query)).pagination.total, 2);
  const before = await readFile(file, 'utf8');
  for (const value of ['0', '-1', '', '1.5', 'NaN', 'Infinity', '9007199254740992']) {
    process.env.ALERT_DEDUP_WINDOW_MS = value;
    await assert.rejects(service.list(snapshot, query));
  }
  assert.equal(await readFile(file, 'utf8'), before);
});

test('suppression is logged as a structured event', async t => {
  const { service } = await setup(t);
  const logs: any[] = [];
  t.mock.method(logger, 'info', (message: string, metadata: unknown) => { logs.push({ message, metadata }); return logger; });
  await service.list({ ...snapshot, events: [event, event, event] }, query);
  const suppressed = logs.find(log => log.message === 'alert_duplicates_suppressed');
  assert.equal(suppressed.metadata.count, 2);
  assert.equal(suppressed.metadata.windowMs, 300000);
});
