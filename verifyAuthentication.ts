// Only run via validate_migrations.py against its disposable seed_test database.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { authDatabase, hashPassword, authService } from '../src/services/authService.js';
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.AUTH_PUBLIC_KEY_PEM = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
process.env.AUTH_PRIVATE_KEY_PEM = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
process.env.AUTH_ISSUER = 'https://auth.test';
process.env.AUTH_AUDIENCE = 'astra-test';
const { app } = await import('../src/app.js');
const db = authDatabase();
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const password = 'Synthetic test password 123';
const login = (email = 'user@example.org', secret = password) => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: secret }) });
const me = (token: string) => fetch(base + '/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
try {
  const user = await db.user.create({ data: { email: 'user@example.org', passwordHash: await hashPassword(password) } });
  await assert.rejects(db.user.create({ data: { email: user.email, passwordHash: user.passwordHash } }));
  const wrong = await login(user.email, 'Wrong password 123');
  const absent = await login('missing@example.org');
  assert.equal(wrong.status, 401); assert.equal(absent.status, 401);
  assert.deepEqual(await wrong.json(), await absent.json());
  const response = await login('USER@example.org');
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.expiresIn, 900);
  const identity = await me(data.accessToken);
  assert.equal(identity.status, 200);
  const profile = await identity.json();
  assert.equal(profile.data.subject, user.id);
  assert.equal(profile.data.role, 'viewer');
  const submit = () => fetch(base + '/api/telemetry/records', { method: 'POST', headers: { authorization: `Bearer ${data.accessToken}`, 'content-type': 'application/json' }, body: '{bad' });
  const refresh = () => fetch(base + '/api/dataset/refresh', { method: 'POST', headers: { authorization: `Bearer ${data.accessToken}`, 'content-type': 'application/json' }, body: '{}' });
  assert.equal((await submit()).status, 403);
  await db.user.update({ where: { id: user.id }, data: { role: 'operator' } });
  assert.equal((await submit()).status, 400);
  assert.equal((await refresh()).status, 403);
  await db.user.update({ where: { id: user.id }, data: { role: 'admin' } });
  assert.equal((await refresh()).status, 200);
  await db.user.update({ where: { id: user.id }, data: { role: 'viewer' } });
  assert.equal((await refresh()).status, 403);
  console.log('PASS: database roles, least-privilege default, upgrades and immediate downgrade');
  assert.equal('passwordHash' in profile.data, false);
  await db.user.update({ where: { id: user.id }, data: { active: false } });
  assert.equal((await me(data.accessToken)).status, 401);
  assert.equal((await login()).status, 401);
  await db.user.update({ where: { id: user.id }, data: { active: true } });
  assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${data.accessToken}` } })).status, 200);
  assert.equal((await me(data.accessToken)).status, 401);
  const second = (await (await login()).json()).data.accessToken;
  const check = authService.sessionActive;
  authService.sessionActive = async () => { throw new Error('private database failure'); };
  try { assert.equal((await me(second)).status, 503); } finally { authService.sessionActive = check; }
  await db.authSession.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
  assert.equal((await me(second)).status, 401);
  // Exercise the per-IP login throttle without repeated password hashing.
  let limited = false;
  for (let i = 0; i < 11; i++) {
    const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (r.status === 429) { limited = true; break; }
  }
  assert.ok(limited);
  console.log('PASS: database login, account status, logout, expiry, outage handling, uniqueness and login throttle');
} finally {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await db.$disconnect();
}
