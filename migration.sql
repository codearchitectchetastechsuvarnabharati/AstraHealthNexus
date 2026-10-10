CREATE TYPE "UserRole" AS ENUM ('viewer', 'operator', 'admin');
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'viewer';
