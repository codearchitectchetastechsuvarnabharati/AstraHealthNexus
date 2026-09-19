import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { AlertService } from '../src/services/alertService.js';
import { createAlertsRouter } from '../src/routes/alertsRoutes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requestLogger } from '../src/middleware/requestLogger.js';

const snapshot = { summary: 'Snapshot', severity: 'info', events: [{ message: 'Crew check', severity: 'info' }, { message: 'Vehicle check', severity: 'warning' }] };
async function setup(t: any) {
  const directory = await mkdtemp(path.join(tmpdir(), 'alert-lifecycle-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'alerts.json');
  const service = new AlertService(file);
  return { service, file };
}

test('open -> acknowledged -> resolved persists across restarts and repeated snapshots', async t => {
  const { service, file } = await setup(t);
  const first = await service.list(snapshot, { limit: 20, offset: 0 });
  const alert = first.events[0];
  assert.equal(alert.status, 'open');
  assert.equal(alert.acknowledgedAt, null);
  assert.equal(alert.resolvedAt, null);
  const ack = await service.transition(alert.id, 'acknowledged');
  assert.ok(ack.acknowledgedAt);
  assert.equal(ack.resolvedAt, null);
  assert.deepEqual(await service.transition(alert.id, 'acknowledged'), ack);
  const restarted = new AlertService(file);
  const resolved = await restarted.transition(alert.id, 'resolved');
  assert.ok(resolved.resolvedAt);
  assert.equal(resolved.acknowledgedAt, ack.acknowledgedAt);
  const reread = await restarted.list(snapshot, { limit: 20, offset: 0 });
  assert.equal(reread.pagination.total, 2);
  assert.deepEqual(reread.events[0], resolved);
  assert.deepEqual(await restarted.transition(alert.id, 'resolved'), resolved);
  assert.deepEqual(await new AlertService(file).get(alert.id), resolved);
});

test('invalid transitions and missing alerts leave stored state unchanged', async t => {
  const { service, file } = await setup(t);
  const alert = (await service.list(snapshot, { limit: 20, offset: 0 })).events[0];
  const before = await readFile(file, 'utf8');
  await assert.rejects(service.transition(alert.id, 'resolved'), { status: 409 });
  assert.equal(await readFile(file, 'utf8'), before);
  await assert.rejects(service.transition('alert_' + '0'.repeat(64), 'acknowledged'), { status: 404 });
  await service.transition(alert.id, 'acknowledged');
  await service.transition(alert.id, 'resolved');
  await assert.rejects(service.transition(alert.id, 'acknowledged'), { status: 409 });
});

test('concurrent updates preserve changes to different alerts and retries', async t => {
  const { service } = await setup(t);
  const { events } = await service.list(snapshot, { limit: 20, offset: 0 });
  await Promise.all(events.flatMap(alert => [service.transition(alert.id, 'acknowledged'), service.transition(alert.id, 'acknowledged')]));
  for (const alert of events) assert.equal((await service.get(alert.id)).status, 'acknowledged');
});

test('filtering paginates stored statuses and changed messages create new alerts', async t => {
  const { service } = await setup(t);
  const first = await service.list(snapshot, { limit: 1, offset: 0 });
  assert.equal(first.pagination.total, 2);
  assert.equal(first.pagination.hasMore, true);
  await service.transition(first.events[0].id, 'acknowledged');
  const filtered = await service.list(snapshot, { limit: 1, offset: 0, status: 'acknowledged' });
  assert.equal(filtered.pagination.total, 1);
  assert.equal(filtered.events[0].id, first.events[0].id);
  const changed = await service.list({ ...snapshot, events: [{ message: 'New condition', severity: 'warning' }] }, { limit: 20, offset: 0 });
  assert.equal(changed.pagination.total, 3);
  assert.equal(changed.events[2].status, 'open');
  assert.equal((await service.list(snapshot, { limit: 1, offset: 99 })).events.length, 0);
});

test('write failures preserve state and subsequent retries succeed', async t => {
  const { service, file } = await setup(t);
  const alert = (await service.list(snapshot, { limit: 20, offset: 0 })).events[0];
  const before = await readFile(file, 'utf8');
  const mock = t.mock.method(service.storage, 'rename', async () => { throw new Error('disk failure'); });
  await assert.rejects(service.transition(alert.id, 'acknowledged'), /disk failure/);
  assert.equal(await readFile(file, 'utf8'), before);
  mock.mock.restore();
  assert.equal((await service.transition(alert.id, 'acknowledged')).status, 'acknowledged');
});

test('corrupt persistent state is never silently replaced', async t => {
  const { service, file } = await setup(t);
  await writeFile(file, '{bad json');
  await assert.rejects(service.list(snapshot, { limit: 20, offset: 0 }));
  assert.equal(await readFile(file, 'utf8'), '{bad json');
});

test('HTTP lifecycle, validation, conflicts, safe errors and recovery', async t => {
  const { service } = await setup(t);
  const app = express();
  app.use(requestLogger);
  app.use(express.json());
  app.use('/api', createAlertsRouter(service, async () => snapshot));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/alerts`;
  const initial = await (await fetch(base)).json();
  const id = initial.events[0].id;
  const patch = (body: unknown, target = id) => fetch(`${base}/${target}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  for (const body of [{}, { status: 'open' }, { status: 1 }, { status: 'acknowledged', extra: true }, null]) assert.equal((await patch(body)).status, 400);
  assert.equal((await patch({ status: 'acknowledged' }, 'bad')).status, 400);
  assert.equal((await patch({ status: 'acknowledged' }, 'alert_' + '0'.repeat(64))).status, 404);
  assert.equal((await patch({ status: 'resolved' })).status, 409);
  assert.equal((await patch({ status: 'acknowledged' })).status, 200);
  assert.equal((await patch({ status: 'resolved' })).status, 200);
  assert.equal((await patch({ status: 'acknowledged' })).status, 409);
  assert.equal((await (await fetch(`${base}/${id}`)).json()).data.status, 'resolved');
  assert.equal((await fetch(base + '?status=bad')).status, 400);
  assert.equal((await fetch(base + '?limit=101')).status, 400);
  const filtered = await (await fetch(base + '?status=resolved')).json();
  assert.equal(filtered.events.length, 1);
  const mock = t.mock.method(service.storage, 'readFile', async () => { throw new Error('private file path'); });
  const failure = await fetch(`${base}/${id}`);
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { status: 'error', message: 'Internal server error' });
  mock.mock.restore();
  assert.equal((await fetch(`${base}/${id}`)).status, 200);
});
