import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { SignJWT } from 'jose';
import { createAuthentication } from '../src/middleware/authentication.js';
import { testToken, testIssuer, testAudience, testPublicKey } from './authTestSupport.js';
import { app } from '../src/app.js';
import { logger } from '../src/middleware/logger.js';

async function serve(t: TestContext, application: express.Express) {
  const server = application.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test('production API gates every route group and keeps liveness public', async t => {
  const base = await serve(t, app);
  assert.equal((await fetch(base + '/api/health')).status, 200);
  for (const path of ['/api/dashboard', '/api/dataset', '/api/alerts', '/api/telemetry/records', '/api/nasa/apod', '/api/nasa/stream', '/api/health/python', '/api/external/python/health', '/api/external/java/health', '/api/auth/me']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 401, path);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
  }
  const blocked = await fetch(base + '/api/telemetry/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
  assert.equal(blocked.status, 401); // Authentication precedes body processing.
  const me = await fetch(base + '/api/auth/me', { headers: { authorization: `Bearer ${await testToken()}`, 'x-user-id': 'forged' } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).data.subject, 'test-user');
  assert.equal((await fetch(base + '/api/dataset/keys', { headers: { authorization: `Bearer ${await testToken()}` } })).status, 200);
});

test('bad signatures, claims and schemes never reach a protected handler or leak tokens', async t => {
  let calls = 0;
  const logs: unknown[] = [];
  t.mock.method(logger, 'info', (...args: unknown[]) => { logs.push(args); return logger; });
  const application = express();
  application.use(createAuthentication());
  application.get('/', (_req, res) => { calls++; res.json({ ok: true }); });
  const base = await serve(t, application);
  const now = Math.floor(Date.now() / 1000);
  const valid = await testToken();
  const wrongAlgorithm = await new SignJWT({ sub: 'test-user', iss: testIssuer, aud: testAudience, iat: now, exp: now + 60 }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(testPublicKey));
  const tokens = [
    await testToken({ exp: now - 1 }), await testToken({ nbf: now + 100 }),
    await testToken({ iss: 'wrong' }), await testToken({ aud: 'wrong' }),
    await testToken({ sub: '' }), await testToken({ jti: undefined }), await testToken({ jti: 'unknown-session' }), await testToken({ exp: undefined }),
    await testToken({ iat: undefined }), await testToken({ iat: now + 60 }),
    await testToken({ exp: now + 7200 }), wrongAlgorithm,
    valid.slice(0, valid.lastIndexOf('.') + 1) + 'invalid_signature'
  ];
  for (const token of tokens) assert.equal((await fetch(base, { headers: { authorization: `Bearer ${token}` } })).status, 401);
  for (const authorization of ['Basic abc', 'Bearer bad', `Bearer ${valid}, Bearer ${valid}`]) assert.equal((await fetch(base, { headers: { authorization } })).status, 401);
  assert.equal((await fetch(base + '?access_token=' + valid)).status, 401);
  assert.equal(calls, 0);
  assert.ok(!JSON.stringify(logs).includes(valid));
});

test('missing or invalid authentication configuration fails closed', async t => {
  for (const config of [{}, { AUTH_ISSUER: testIssuer, AUTH_AUDIENCE: testAudience, AUTH_PUBLIC_KEY_PEM: 'invalid' }]) {
    const application = express();
    application.use(createAuthentication(() => config));
    application.get('/', () => assert.fail('protected handler must not run'));
    const base = await serve(t, application);
    assert.equal((await fetch(base, { headers: { authorization: `Bearer ${await testToken()}` } })).status, 503);
  }
});
