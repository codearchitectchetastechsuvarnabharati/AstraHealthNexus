import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

export const CredentialsSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(12).max(128) }).strict();
export class AuthError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
let client: PrismaClient | undefined;
export function authDatabase() { return client ??= new PrismaClient(); }
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128) throw new Error('Password must contain 12 to 128 characters');
  const salt = randomBytes(16);
  return `scrypt-v1$${salt.toString('hex')}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const parts = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(hash);
  if (!parts) throw new Error('Invalid password hash');
  return timingSafeEqual(await derive(password, Buffer.from(parts[1], 'hex')), Buffer.from(parts[2], 'hex'));
}
const dummy = 'scrypt-v1$' + '0'.repeat(32) + '$' + '0'.repeat(128);
let activeLogins = 0;
export const authService = {
  async login(email: string, password: string) {
    if (activeLogins >= 4) throw new AuthError(503, 'Authentication temporarily unavailable');
    activeLogins++;
    try {
      const db = authDatabase();
      const user = await db.user.findUnique({ where: { email } });
      const valid = await verifyPassword(password, user?.passwordHash ?? dummy);
      if (!user || !valid || !user.active) throw new AuthError(401, 'Invalid email or password');
      const issuer = process.env.AUTH_ISSUER;
      const audience = process.env.AUTH_AUDIENCE;
      const privatePem = process.env.AUTH_PRIVATE_KEY_PEM?.replace(/\\n/g, '\n');
      const publicPem = process.env.AUTH_PUBLIC_KEY_PEM?.replace(/\\n/g, '\n');
      if (!issuer || !audience || !privatePem || !publicPem) throw new Error('Authentication configuration missing');
      const key = await importPKCS8(privatePem, 'RS256');
      const now = Math.floor(Date.now() / 1000);
      const sessionId = randomUUID();
      const accessToken = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
        .setSubject(user.id).setIssuer(issuer).setAudience(audience).setJti(sessionId)
        .setIssuedAt(now).setExpirationTime(now + 900).sign(key);
      // Fail before storing a session if the configured signing/verification keys differ.
      await jwtVerify(accessToken, await importSPKI(publicPem, 'RS256'), { issuer, audience, algorithms: ['RS256'] });
      await db.authSession.create({ data: { id: sessionId, userId: user.id, expiresAt: new Date((now + 900) * 1000) } });
      return { accessToken, tokenType: 'Bearer', expiresIn: 900 };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(503, 'Authentication temporarily unavailable');
    } finally { activeLogins--; }
  },
  async sessionActive(sessionId: string, userId: string) {
    const session = await authDatabase().authSession.findUnique({ where: { id: sessionId }, select: { userId: true, expiresAt: true, revokedAt: true, user: { select: { active: true, role: true } } } });
    return session && session.userId === userId && session.user.active && session.revokedAt === null && session.expiresAt.getTime() > Date.now() ? session.user.role : null;
  },
  async logout(sessionId: string, userId: string) {
    await authDatabase().authSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
};
