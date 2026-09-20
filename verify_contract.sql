-- Run against a disposable PostgreSQL database AFTER prisma migrate deploy.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/prisma/verify_contract.sql
-- Every test is rolled back; no application records are retained.
BEGIN;
INSERT INTO "Mission" ("id") VALUES ('scrum34_verification');
INSERT INTO "MissionTelemetry" ("id", "source", "category", "mission", "timestamp", "origin", "payload")
VALUES ('scrum34_measurement', 'iss', 'orbit', 'scrum34_verification', NOW(), 'submitted', '{"latitude":0,"longitude":0,"altitude":400,"velocity":27600}');
DO $$ BEGIN
  BEGIN
    UPDATE "MissionTelemetry" SET "category" = 'crew' WHERE "id" = 'scrum34_measurement';
    RAISE EXCEPTION 'Expected source/category constraint';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE "MissionTelemetry" SET "payload" = '[]' WHERE "id" = 'scrum34_measurement';
    RAISE EXCEPTION 'Expected object payload constraint';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    DELETE FROM "Mission" WHERE "id" = 'scrum34_verification';
    RAISE EXCEPTION 'Expected mission delete restriction';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    UPDATE "MissionTelemetry" SET "mission" = 'missing_mission_scrum34' WHERE "id" = 'scrum34_measurement';
    RAISE EXCEPTION 'Expected mission foreign key';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    UPDATE "MissionTelemetry" SET "origin" = 'invalid' WHERE "id" = 'scrum34_measurement';
    RAISE EXCEPTION 'Expected origin enum rejection';
  EXCEPTION WHEN invalid_text_representation THEN NULL; END;
END $$;
INSERT INTO "AlertEvent" ("id", "severity", "message", "createdAt", "updatedAt")
VALUES ('alert_' || repeat('a',64), 'warning', 'SCRUM-34 check', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
DO $$ BEGIN
  BEGIN
    UPDATE "AlertEvent" SET "status" = 'resolved' WHERE "id" = 'alert_' || repeat('a',64);
    RAISE EXCEPTION 'Expected lifecycle timestamp rejection';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE "AlertEvent" SET "id" = 'legacy_uuid' WHERE "id" = 'alert_' || repeat('a',64);
    RAISE EXCEPTION 'Expected alert ID rejection';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE "AlertEvent" SET "status"='acknowledged', "acknowledgedAt"='2026-01-02T00:00:00Z', "updatedAt"='2026-01-02T00:00:00Z' WHERE "id"='alert_' || repeat('a',64);
UPDATE "AlertEvent" SET "status"='resolved', "resolvedAt"='2026-01-03T00:00:00Z', "updatedAt"='2026-01-03T00:00:00Z' WHERE "id"='alert_' || repeat('a',64);
-- Identical events at a later time must remain possible (deduplication is time-window based).
INSERT INTO "AlertEvent" ("id", "severity", "message", "createdAt", "updatedAt")
VALUES ('alert_' || repeat('b',64), 'warning', 'SCRUM-34 check', '2026-01-04T00:00:00Z', '2026-01-04T00:00:00Z');
ROLLBACK;
