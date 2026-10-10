# SCRUM-39: role-based API authorization

Roles are viewer, operator and admin. The additive UserRole migration assigns viewer to all existing users and defaults new accounts to viewer. No user is automatically elevated.

## Permissions

- Viewer: read dashboard, datasets, telemetry, alerts, NASA, service health and permitted Python/Java read routes.
- Operator: Viewer permissions plus telemetry submission and alert acknowledgement/resolution.
- Admin: Operator permissions plus dataset/cache refresh, including legacy GET/HEAD refresh calls through Python/Java.
- Every authenticated role can read its own identity and log out.

Node reads the current role in the same database query that verifies the session. It does not trust role/permission claims in tokens, headers, query parameters or request bodies. Role changes take effect on the next request without issuing a new token. GET /api/auth/me includes role. Existing streams are checked at connection time; role changes do not forcibly disconnect established streams.

The central authorization middleware runs immediately after authentication and before body parsing, service calls and proxy forwarding. Missing identity returns 401; authenticated callers lacking permission receive 403. Unknown endpoints/methods are denied even to Admin until the explicit policy is extended. Protected path handling rejects encoded/ambiguous paths and recognizes case/trailing-slash variations of refresh routes. Query strings do not determine permission.

Public login and Node liveness remain public. Python/Java ports must remain private/loopback. These are capability roles, not per-mission or per-record ownership restrictions. No public role-management API is added.

## Provision and manage roles

Run migrations and regenerate Prisma Client using the existing db:migrate and db:generate commands. To create an account, optionally set AUTH_USER_ROLE=viewer, operator or admin when using auth:create-user. Omission uses viewer. Invalid values fail without account creation.

To change an existing account, set AUTH_USER_EMAIL and AUTH_USER_ROLE in the trusted administration shell and run:

    npm --prefix server run auth:set-role

The command validates the role, normalizes email and updates only an existing user. This is a local database-admin capability, not an authenticated HTTP endpoint; protect database credentials and host access. Use it to explicitly provision your first admin after migration. Never deploy a default admin password.

## Verification

Unit/HTTP tests cover all roles, allowed and denied operations, proxy GET refresh, default-deny routes, forged role claims, denied requests not reaching handlers, and immediate role changes. The isolated PostgreSQL validator also verifies the default viewer role and live promotion/demotion with the same token. Earlier authentication/session/seed/migration checks still run.

## Files for this PR

- server/prisma/schema.prisma
- server/prisma/migrations/20261010000200_user_roles/migration.sql
- server/src/services/authService.ts
- server/src/middleware/authentication.ts
- server/src/middleware/authorization.ts
- server/src/app.ts
- server/scripts/createUser.ts
- server/scripts/setUserRole.ts
- server/package.json
- server/tests/authTestSupport.ts
- server/tests/authorization.test.ts
- server/tests/failures.test.ts
- server/prisma/verifyAuthentication.ts
- server/AUTHENTICATION.md
- server/AUTHORIZATION.md
- DEV_SETUP.txt

Requires database-backed SCRUM-38. Existing migrations remain unchanged; no dependency or lockfile changes are needed.
