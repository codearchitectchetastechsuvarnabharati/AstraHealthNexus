import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { authorize, requiredPermission } from '../src/middleware/authorization.js';
import { testToken } from './authTestSupport.js';
import { authService } from '../src/services/authService.js';
import { app } from '../src/app.js';
import type { UserRole } from '@prisma/client';

async function serve(t: TestContext, application: express.Express) {
  const server = application.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test('roles enforce read, operation and refresh permissions before handlers', async t => {
  let role: UserRole = 'viewer';
  let calls = 0;
  const application = express();
  application.use((req, _res, next) => { req.user = { subject: 'test', issuer: 'test', expiresAt: 9999999999, sessionId: 'test', role }; next(); });
  application.use('/api', authorize);
  application.use((_req, res) => { calls++; res.json({ ok: true }); });
  const base = await serve(t, application);
  const routes: Array<[string, string, number]> = [
    ['GET', '/dashboard', 0], ['GET', '/dataset', 0], ['GET', '/telemetry/records', 0],
    ['GET', '/nasa/stream', 0], ['GET', '/health/python', 0], ['GET', '/auth/me', 0],
    ['POST', '/auth/logout', 0], ['POST', '/telemetry/records', 1], ['PATCH', '/alerts/id/status', 1],
    ['POST', '/dataset/refresh', 2], ['GET', '/external/python/api/dataset/refresh', 2],
    ['POST', '/external/java/api/dataset/refresh', 2], ['HEAD', '/external/java/api/dataset/refresh', 2],
    ['GET', '/external/python/api/dataset/iss', 0]
  ];
  for (const [rank, current] of (['viewer', 'operator', 'admin'] as const).entries()) {
    role = current;
    for (const [method, path, minimum] of routes) {
      const before = calls;
      const result = await fetch(base + '/api' + path, { method });
      assert.equal(result.status, rank >= minimum ? 200 : 403, `${role} ${method} ${path}`);
      assert.equal(calls - before, rank >= minimum ? 1 : 0);
    }
  }
});

test('unknown routes, methods and ambiguous paths are denied, even for admin', () => {
  for (const path of ['/new-sensitive-api', '/external/java/new-admin-api', '/external/python/api/dataset/%72efresh', '/external/python//api/dataset/refresh']) {
    assert.equal(requiredPermission('GET', path), undefined);
  }
  assert.equal(requiredPermission('DELETE', '/dataset'), undefined);
  assert.equal(requiredPermission('GET', '/dataset/refresh'), undefined);
  assert.equal(requiredPermission('GET', '/EXTERNAL/JAVA/API/DATASET/REFRESH/'), 'refresh');
});

test('production app uses database role, ignores token/header roles and applies changes immediately', async t => {
  let role: UserRole = 'viewer';
  t.mock.method(authService, 'sessionActive', async () => role);
  const base = await serve(t, app);
  const token = await testToken({ role: 'admin', permissions: ['*'] });
  const headers = { authorization: `Bearer ${token}`, 'x-role': 'admin', 'content-type': 'application/json' };
  assert.equal((await fetch(base + '/api/dataset/keys', { headers })).status, 200);
  assert.equal((await fetch(base + '/api/telemetry/records', { method: 'POST', headers, body: '{bad' })).status, 403);
  assert.equal((await fetch(base + '/api/external/python/api/dataset/refresh', { headers })).status, 403);
  role = 'operator';
  // Reaches validation only after authorization; no data is written.
  assert.equal((await fetch(base + '/api/telemetry/records', { method: 'POST', headers, body: '{bad' })).status, 400);
  assert.equal((await fetch(base + '/api/dataset/refresh', { method: 'POST', headers, body: '{}' })).status, 403);
  role = 'admin';
  assert.equal((await fetch(base + '/api/dataset/refresh', { method: 'POST', headers, body: '{}' })).status, 200);
  role = 'viewer';
  assert.equal((await fetch(base + '/api/dataset/refresh', { method: 'POST', headers, body: '{}' })).status, 403);
  const me = await (await fetch(base + '/api/auth/me', { headers })).json();
  assert.equal(me.data.role, 'viewer');
});
