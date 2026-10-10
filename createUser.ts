import { UserRole } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { authDatabase, CredentialsSchema, hashPassword } from '../src/services/authService.js';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
try {
  const credentials = CredentialsSchema.parse({ email: process.env.AUTH_USER_EMAIL, password: process.env.AUTH_USER_PASSWORD });
  const role = process.env.AUTH_USER_ROLE ?? 'viewer';
  if (!Object.values(UserRole).includes(role as UserRole)) throw new Error('Invalid role');
  await authDatabase().user.create({ data: { email: credentials.email, role: role as UserRole, passwordHash: await hashPassword(credentials.password) } });
  console.log('User created. No existing account was changed.');
} catch { console.error('User creation failed. Check credentials, database migrations and whether the email already exists.'); process.exitCode = 1; }
finally { delete process.env.AUTH_USER_PASSWORD; await authDatabase().$disconnect(); }
