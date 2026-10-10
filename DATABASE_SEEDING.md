# SCRUM-37: deterministic development/test seed data

## Fixtures

Two synthetic missions (seed_demo_orbit, seed_demo_training), 36 telemetry measurements and four alerts. Each mission has three observation batches with all six source/category pairs. Both collected and submitted origins are represented. Fixed UTC times start on 2026-01-01, so tests do not depend on today's date. Filter by this date range rather than a recent-time window.

Alerts cover open, acknowledged and resolved lifecycle states with consistent timestamps. Two matching events are six minutes apart, representing valid recurrence outside the default five-minute suppression window. This demonstrates fixture data; database seeds do not run AlertService's deduplication algorithm. Telemetry payloads pass the backend intake schema.

## Running on a development/test database

Set DATABASE_URL to your intended development/test PostgreSQL database. From the project root in PowerShell:

    $env:NODE_ENV = 'development'
    $env:ALLOW_DATABASE_SEED = 'true'
    npm --prefix server run db:generate
    npm --prefix server run db:migrate
    npm --prefix server run db:seed

The seed command loads the project-root .env without overriding existing environment variables. NODE_ENV must explicitly be development or test and ALLOW_DATABASE_SEED must be true. Production/unset environments and missing DATABASE_URL fail before connecting. These checks do not identify the database's real purpose: choose the development/test URL deliberately. Existing populated legacy databases still require the SCRUM-34 migration/backfill process.

Prisma's db seed hook is also configured in server/package.json; run it from the server directory. db:seed is the root-friendly npm command.

## Repeatability and storage

Stable reserved IDs identify all seed-owned rows (telemetry IDs begin seed_v1_, mission IDs begin seed_demo_, alert IDs derive from SHA-256 of astra-seed-v1 plus the scenario). Rerunning resets these fixture rows to their original values, including alert status/timestamps, without adding duplicates. Treat those IDs as seed-owned; do not reuse them for real records. No tables are truncated and no unrelated records are deleted or updated.

All upserts occur in one transaction. A PostgreSQL transaction-scoped advisory lock serializes concurrent seed runs. Any failure rolls back all fixture changes. The seed does not alter migrations or generate random/current-date values.

These seeds populate PostgreSQL only. Current API telemetry still uses memory and alerts still use runtime/alerts.json; those stores and local JSON datasets are untouched. DB seed data will not appear automatically in current file/memory-backed API endpoints. The fixture module can be imported in tests; the CLI does not run when imported.

## Verification

The regular Node tests validate fixture coverage, IDs, intake compatibility and environment guards. Seed scripts are also checked with TypeScript independently of the src-only backend build.

The SCRUM-35 migration validator now creates an additional seed_test database, generates Prisma Client and executes verifySeed.ts there. It tests fresh seeding, concurrent reruns, unrelated mission preservation, lifecycle transitions/reset, filtered pagination and full transaction rollback on an injected database constraint failure. Use test:migrations with --postgres-bin as described in MIGRATION_VALIDATION.md. Never run verifySeed.ts against an application database; it is exclusively an isolated test harness.

## PR files

- server/package.json (modified)
- server/prisma/seedData.ts (new)
- server/prisma/seed.ts (new)
- server/prisma/verifySeed.ts (new)
- server/tests/seedData.test.ts (new)
- server/scripts/validate_migrations.py (modified)
- server/MIGRATION_VALIDATION.md (modified)
- server/DATABASE_SEEDING.md (new)

No schema migration is required for these fixtures. Existing migrations through SCRUM-36 are prerequisites. Do not commit .env, generated clients, temporary PostgreSQL binaries or database directories.
