# SCRUM-35: migration creation and validation

The two versioned migrations from SCRUM-34 already implement the current schema. SCRUM-35 reuses them rather than adding a duplicate migration or rewriting migration history. This task adds repeatable validation and deployment commands and fixes the SQL test to accept PostgreSQL's restrict_violation as well as foreign_key_violation for a restricted parent deletion.

## Run the isolated validator

From the project root:

    npm --prefix server run test:migrations -- --postgres-bin "C:/path/to/postgresql/bin"

Prerequisites: Python 3.10+, Node with installed project dependencies, PostgreSQL initdb/pg_ctl and its libpq client library. Windows PostgreSQL distributions must include libpq.dll and its dependencies in the supplied bin directory. On other platforms libpq must be discoverable by the system loader. A normal non-root account must be able to initialize a cluster.

The validator creates a new temporary cluster and four disposable databases on an available loopback port. It overrides DATABASE_URL for every Prisma command and never uses the application database URL. Cluster authentication is trust for this short-lived local test with synthetic data only. Do not expose the port or reuse this setup for deployment. It stops the cluster in a finally block and retains diagnostic files in the printed temporary directory. Windows subprocesses run without visible windows.

Checks:

- Prisma schema validation.
- Fresh deploy of both migrations and successful migration status.
- A second deploy with no duplicate application.
- Database-to-Prisma schema diff with exit-code enforcement (no drift).
- Database CHECK, enum and foreign-key tests, legal lifecycle updates and repeated alerts.
- Verification that the SQL tests roll back their inserted data.
- Baseline an existing empty original schema, then upgrade it.
- Refuse populated legacy telemetry, preserving its original payload and leaving no partial new schema.

## Deployment commands

    npm --prefix server run db:validate
    npm --prefix server run db:migrate

These commands use the configured application DATABASE_URL and db:migrate changes that database. They were NOT run against the user's application database during this task. For an existing installation, follow PRISMA_AUDIT.md first: confirm the baseline matches and explicitly baseline it. Populated legacy tables need a deployment-specific reviewed backfill; the validation deliberately proves that the generic migration refuses them. Do not remove the guard or delete legacy data to force deployment.

## Validation result

Executed successfully on an isolated PostgreSQL 18.4 runtime with the project's Prisma 5.22.0. All scenarios above passed. No application database was accessed. This verifies the current migration history, not an automatic populated-database conversion or a change of runtime storage from files/memory to Prisma.

## SCRUM-35 PR files

- server/package.json (migration scripts)
- server/scripts/validate_migrations.py (new isolated validator)
- server/prisma/verify_contract.sql (PostgreSQL-compatible deletion assertion)
- server/MIGRATION_VALIDATION.md (new instructions/results)

Prerequisite: merge SCRUM-34's schema, migrations and audit first. Its two migration SQL files and migration_lock.toml remain unchanged. The downloaded portable runtime lives in the system temporary folder, not in the repository; do not upload runtime binaries or generated Prisma files.

## SCRUM-37 seed verification

The validator also creates a separate seed_test database, applies the current migrations and generates Prisma Client. It runs prisma/verifySeed.ts to check fixture insertion, concurrent reruns, unrelated-data preservation, lifecycle reset, pagination and transactional rollback. This uses test-only environment settings and never the application DATABASE_URL. See DATABASE_SEEDING.md for fixture and command details.
