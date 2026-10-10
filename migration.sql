CREATE TABLE "User" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "email" VARCHAR(254) NOT NULL,
 "passwordHash" TEXT NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "User_email_normalized" CHECK ("email" = lower(btrim("email")) AND length("email") > 0)
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "AuthSession" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "expiresAt" TIMESTAMPTZ(3) NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "revokedAt" TIMESTAMPTZ(3),
 CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
