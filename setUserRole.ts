import { UserRole } from '@prisma/client';
import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { authDatabase } from '../src/services/authService.js';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
try {
  const email = z.string().trim().toLowerCase().email().max(254).parse(process.env.AUTH_USER_EMAIL);
  const role = z.nativeEnum(UserRole).parse(process.env.AUTH_USER_ROLE);
  await authDatabase().user.update({ where: { email }, data: { role } });
  console.log('Role updated. It takes effect on the next protected request.');
} catch { console.error('Role update failed. Check email, role, database access and migrations.'); process.exitCode = 1; }
finally { await authDatabase().$disconnect(); }
