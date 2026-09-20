# SCRUM-34: Prisma schema alignment

## Evidence and scope

The previous schema contained only MissionTelemetry (source/category/payload/createdAt) and AlertEvent (severity/message/source/createdAt). No runtime backend module instantiates PrismaClient. TelemetryRecordStore currently keeps telemetry in memory; AlertService writes runtime/alerts.json. These stores are unchanged. Updating the schema alone does not make the application database-backed.

Reviewed requirements: telemetryRecordsService.ts, IncomingTelemetryRecordSchema and TelemetryRecordsQuery in schemas.ts, datasetCatalog.ts, and alertService.ts.

## Models and constraints

MissionTelemetry now represents timestamp, receivedAt, origin, source, category, mission and values. receivedAt maps to the original createdAt column and values maps to payload, avoiding unnecessary column renames. All timestamps use PostgreSQL TIMESTAMPTZ(3). There is no constraint requiring timestamp <= receivedAt: the current intake accepts future observation times. There is no uniqueness rule on timestamp/source because repeated observations are allowed.

Mission contains the only required field in telemetry intake: the mission identifier. It deliberately does not require a full mission profile. Telemetry has a required foreign key with restricted mission deletion and cascading identifier updates. A future persistence adapter must upsert the mission identity and insert telemetry in a transaction. The ID constraint matches intake's 1..100 ASCII identifier characters.

TelemetryOrigin restricts origin to collected/submitted. A SQL CHECK enforces the six source/category pairs from datasetCatalog.ts and another requires an object JSON payload. Per-source measurement fields and numeric ranges remain the responsibility of IncomingTelemetryRecordSchema; they are not duplicated as large SQL JSON rules. Indexes support timestamp ordering and mission/source/category filters.

AlertEvent now has open/acknowledged/resolved status and created/updated/acknowledged/resolved times. Its ID has no UUID default: AlertService generates alert_ plus 64 lowercase hexadecimal characters. SQL checks enforce that format, dashboard source and lifecycle timestamp consistency. Severity remains a string because AlertService currently accepts arbitrary severity strings. No mission/telemetry link is invented because dashboard alerts carry neither identifier.

updatedAt is explicitly maintained by the future persistence adapter rather than Prisma @updatedAt, to preserve idempotent transitions and exact lifecycle timestamps. Database CHECK constraints validate row state; the existing AlertService enforces legal state transitions. A database-backed implementation must use transactional/conditional updates to preserve that transition rule. Likewise, temporal deduplication is a service rule, not permanent uniqueness on message/source/severity. The alert indexes support status listing and candidate searches for deduplication.

## Migration safety

1. New empty database: apply the two checked-in migrations using Prisma migrate deploy with the schema path server/prisma/schema.prisma.
2. Existing database with the original tables but no migration history: first confirm its structure matches the original baseline, back it up, and mark 20260920000100_baseline as applied with Prisma migrate resolve. Do not execute the baseline CREATE TABLE statements against existing tables.
3. The second migration locks the original tables and refuses to run if either contains rows. Existing UUID alert IDs and telemetry rows lack enough information for a trustworthy automatic conversion. This guard prevents invented mission IDs, observation times, origins, lifecycle state or discarded history.
4. A populated database requires a reviewed deployment-specific backfill migration BEFORE deploying this migration history. Establish real field mappings and preserve old IDs through an explicit mapping if needed. Do not delete records just to bypass the guard. The generic migration is ready for empty databases only; after deployment do not edit applied migrations.
5. No database migration, baseline operation or application data import was run during this task. Memory history and JSON alert state are not automatically imported.

Prisma schema syntax cannot express the SQL CHECK constraints; use the checked-in migrations, not db push, to install them. Existing TIMESTAMP columns are interpreted as UTC in conversion. For populated legacy data that assumption also needs verification during backfill design.

## Verification

Validate and generate the client with the installed Prisma CLI using --schema server/prisma/schema.prisma. Use a disposable PostgreSQL database for migrate deploy, then execute server/prisma/verify_contract.sql with psql ON_ERROR_STOP enabled. The script checks category/payload constraints, mission referential integrity, origin values, alert lifecycle consistency and legitimate repeated alerts, then rolls back.

Local schema validation and client generation do not prove live migration execution. PostgreSQL migration/constraint verification must run in a PostgreSQL environment before deployment.

## PR files

- server/prisma/schema.prisma (modified)
- server/prisma/migrations/migration_lock.toml (new)
- server/prisma/migrations/20260920000100_baseline/migration.sql (new)
- server/prisma/migrations/20260920000200_backend_contract/migration.sql (new)
- server/prisma/verify_contract.sql (new)
- server/PRISMA_AUDIT.md (new)

Do not upload generated Prisma client files under node_modules or compiled backend output.
