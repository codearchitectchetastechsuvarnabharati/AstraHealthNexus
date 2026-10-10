# SCRUM-38: database-backed Node authentication

Node owns user login, password verification and token issuance. PostgreSQL stores users and revocable sessions. Python/Java remain private behind Node's authenticated gateway; they do not receive passwords, private signing keys or user bearer tokens. All /api routes require authentication except GET/HEAD /api/health and POST /api/auth/login. CORS preflight performs no protected action.

## Setup

Use Node 20+ (Node 24 recommended), install the root lockfile, and configure DATABASE_URL. Set AUTH_ISSUER to a stable name/URL for this Node issuer and AUTH_AUDIENCE to the API identifier; an external identity provider is no longer required. Supply a matching RSA key pair (at least 2048 bits): AUTH_PRIVATE_KEY_PEM in PKCS#8 format and AUTH_PUBLIC_KEY_PEM in SPKI format. Literal backslash-n line separators are accepted. Generate keys with a trusted local key tool and store the private key as a server secret, not in Git or frontend code.

From the project root:

    npm --prefix server run db:generate
    npm --prefix server run db:migrate

These commands target DATABASE_URL. Follow the earlier baseline/backfill instructions for a legacy database; no application database was modified during development of this task.

Provision a user through the local admin command, with AUTH_USER_EMAIL and AUTH_USER_PASSWORD supplied in the process environment:

    npm --prefix server run auth:create-user

Use a securely prompted password rather than typing it into shell history. The command creates only a new account, normalizes email, and refuses duplicate accounts. It does not reset passwords or reactivate users. There is no public registration endpoint, default account or seeded password. Passwords must contain 12..128 characters. Existing environment values take precedence over root .env. Clear AUTH_USER_PASSWORD from the parent shell afterward; the child process cannot clear its parent's environment.

## API workflow

POST /api/auth/login with application/json body containing email and password. Success returns status=success and data containing accessToken, tokenType=Bearer and expiresIn=900. Send Authorization: Bearer <accessToken> on subsequent API calls. GET /api/auth/me returns verified subject, issuer, expiresAt and sessionId, never the password/hash. POST /api/auth/logout revokes the current session; subsequent uses of that token return 401. An already-revoked token also returns 401 on another logout attempt. Login again after expiry; refresh tokens are not implemented.

Wrong password, unknown email and inactive account return the same 401 message. Invalid request shape returns 400, non-JSON login returns 415, too many login attempts returns 429, and database/signing configuration failures return a safe 503. Login is limited to 10 attempts per IP per 15 minutes, with at most four expensive password checks in flight per Node process. The existing global limiter still applies. For multiple replicas, a shared limiter is a deployment follow-up.

Passwords use salted scrypt (N=32768, r=8, p=3) and timing-safe comparison. No plaintext passwords are stored. Unknown accounts perform the same password derivation using a dummy hash. Error logging replaces parser errors with a safe message so malformed request contents are not logged.

Signed tokens use RS256, verified issuer/audience and mandatory subject, issued-at, expiry and session ID. Node-generated tokens last 15 minutes; verification caps any signed token at one hour and requires a live matching DB session. Each request checks that the account is active, the session belongs to that user, and it is unexpired/unrevoked. Database failures deny access rather than bypass verification. Deactivation blocks existing sessions while inactive; reactivation permits any still-valid unrevoked sessions. Revoke a user's sessions when permanent invalidation is required.

## Limits and deployment

This is identity verification, not role authorization: active authenticated users currently share access to protected routes. User/password reset, role management, refresh tokens, account administration UI and login UI are not included. Frontend callers must implement login/token handling. Use HTTPS in deployment; do not place tokens in URLs or logs. Native EventSource cannot set Authorization; use an authenticated fetch stream reader. Streams authenticate at connection time and are not closed immediately on token expiry/logout.

Python/Java ports must remain private/loopback so clients cannot bypass Node. Internal Python health monitoring continues its versioned private protocol. Telemetry/alerts retain their existing memory/file stores; only authentication now depends on Prisma at runtime. Expired/revoked session cleanup should be scheduled by deployment operations. Key rotation requires updating the key pair and restarting services, invalidating old signatures. Existing SCRUM-38 external signed tokens without a corresponding DB session no longer authenticate.

## Validation

Regular tests use ephemeral RSA keys and mock session storage in their isolated test process; production has no authentication bypass. Tests cover password hashing, signature/claim rejection, protected route groups and configuration failures. The PostgreSQL migration validator runs verifyAuthentication.ts against its disposable seed_test database to exercise real login, duplicate email rejection, account deactivation, logout, expired sessions, database-check failure handling and login throttling. No real user is created by the validator.

## Complete SCRUM-38 PR file list (supersedes the earlier list)

- server/src/middleware/authentication.ts
- server/src/middleware/errorHandler.ts
- server/src/services/authService.ts
- server/src/routes/authRoutes.ts
- server/src/app.ts
- server/prisma/schema.prisma
- server/prisma/migrations/20261010000100_user_authentication/migration.sql
- server/prisma/verifyAuthentication.ts
- server/scripts/createUser.ts
- server/scripts/validate_migrations.py
- server/tests/authentication.test.ts
- server/tests/authTestSupport.ts
- server/tests/passwords.test.ts
- server/tests/catalogTelemetry.test.ts
- server/tests/telemetryIntake.test.ts
- server/tests/failures.test.ts
- server/package.json
- package-lock.json
- .env.example
- server/AUTHENTICATION.md

Official JWT verification reference: https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md
