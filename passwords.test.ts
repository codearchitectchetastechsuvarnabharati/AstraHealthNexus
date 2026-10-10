import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, CredentialsSchema } from '../src/services/authService.js';

test('password hashes have random salts and reject incorrect passwords', async () => {
  const password = 'Example only password 123';
  const one = await hashPassword(password);
  const two = await hashPassword(password);
  assert.notEqual(one, two);
  assert.ok(!one.includes(password));
  assert.equal(await verifyPassword(password, one), true);
  assert.equal(await verifyPassword('Incorrect password 123', one), false);
  await assert.rejects(verifyPassword(password, 'bad-hash'));
});
test('credentials normalize email and bound password input', () => {
  assert.equal(CredentialsSchema.parse({ email: ' USER@example.org ', password: 'Example password 123' }).email, 'user@example.org');
  assert.equal(CredentialsSchema.safeParse({ email: 'user@example.org', password: 'short' }).success, false);
  assert.equal(CredentialsSchema.safeParse({ email: 'user@example.org', password: 'x'.repeat(129) }).success, false);
  assert.equal(CredentialsSchema.safeParse({ email: 'user@example.org', password: 'Example password 123', active: true }).success, false);
});
