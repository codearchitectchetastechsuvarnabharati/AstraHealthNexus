# SCRUM-36: query efficiency review

## Current operations

Backend source still has no active PrismaClient operations. Telemetry lives in memory, alerts in JSON files, and dataset access uses the existing file cache. This change improves the live read path and the planned database index; it does not introduce database persistence or claim production SQL speedups.

Telemetry queries previously parsed timestamps repeatedly, allocated a complete filtered array, reversed it and sorted it on every request. They also scanned retention timestamps again. The store now caches numeric timestamps and descending observation-time order until a successful write. Each query parses its time boundaries once and allocates only the requested page while still counting all matching records. Results retain newest-insertion-first tie ordering, insertion-based retention, exact pagination totals and caller mutation isolation. Both collected and submitted writes invalidate ordering. Old/new retention timestamps come from the ordered endpoints.

The periodic ingestion loop now skips ticks while an earlier collection is pending, preventing queued/overlapping repeated dataset work. It resumes after either success or failure and returns a timer cleanup function. Existing external caches, request coalescing and bounded retry policies already address repeated external calls; those are unchanged.

## Index review

Existing telemetry indexes cover chronological reads and source/category/mission filters. The alert status-leading index covers status-filtered chronological lists; it cannot directly provide global chronological ordering when status is omitted. Added AlertEvent(createdAt,id) for that unfiltered list, with stable tie ordering. No payload/message indexes or speculative filter combinations were added.

A new additive migration 20260920000300_alert_list_index creates the index without rewriting existing migration files or records. CREATE INDEX takes a write lock while building; schedule migration during a maintenance window for a large populated table. Current file-backed alerts do not use this database index yet.

## Verification

queryEfficiency.test.ts checks ordering/filter/page equivalence over retained records, tie order, exact totals, timestamp parsing reuse, invalid-batch safety, caller isolation and overlapping ingestion prevention. Existing backend regression tests remain applicable.

The migration validator now counts migration files dynamically and runs verify_query_plan.sql. The SQL script seeds 10,000 synthetic alerts, ANALYZEs them, and checks that PostgreSQL chooses the chronological index without a Sort for ORDER BY createdAt,id LIMIT 20, then rolls back. This is representative plan validation, not a benchmark or guarantee for every data distribution. Run the SCRUM-35 validator against a disposable cluster as documented in MIGRATION_VALIDATION.md.

## PR files

- server/src/services/telemetryRecordsService.ts (modified)
- server/src/services/ingestionService.ts (modified)
- server/prisma/schema.prisma (modified)
- server/prisma/migrations/20260920000300_alert_list_index/migration.sql (new)
- server/prisma/verify_query_plan.sql (new)
- server/scripts/validate_migrations.py (modified)
- server/tests/queryEfficiency.test.ts (new)
- server/QUERY_OPTIMIZATION.md (new)

Requires prior migration history and validator from SCRUM-34/35. Do not upload temporary PostgreSQL files or generated output.
