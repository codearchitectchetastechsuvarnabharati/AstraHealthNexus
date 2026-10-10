import { authService } from '../src/services/authService.js';
import { generateKeyPairSync } from 'node:crypto';
import { SignJWT } from 'jose';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const testPrivateKey = keys.privateKey;
export const testIssuer = 'https://auth.astra.test';
export const testAudience = 'astra-api-tests';
export const testPublicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
process.env.AUTH_PUBLIC_KEY_PEM = testPublicKey;
process.env.AUTH_ISSUER = testIssuer;
process.env.AUTH_AUDIENCE = testAudience;
// Isolated test process: mock only session storage, never signature verification.
authService.sessionActive = async (id, user) => id === 'test-session' && user === 'test-user';
export async function testToken(claims: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: 'test-user', jti: 'test-session', iss: testIssuer, aud: testAudience, iat: now, exp: now + 300, ...claims }).setProtectedHeader({ alg: 'RS256' }).sign(testPrivateKey);
}
export const authenticatedFetch: typeof globalThis.fetch = async (input, init) => {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (!headers.has('authorization')) headers.set('authorization', `Bearer ${await testToken()}`);
  return globalThis.fetch(input, { ...init, headers });
};
