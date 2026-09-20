BEGIN;
-- Legacy records lack mission, observation time, origin and lifecycle identity.
-- Refuse to invent these values or discard records. See PRISMA_AUDIT.md.
LOCK TABLE "MissionTelemetry", "AlertEvent" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "MissionTelemetry") OR EXISTS (SELECT 1 FROM "AlertEvent") THEN
    RAISE EXCEPTION 'Legacy rows require an explicit reviewed backfill before SCRUM-34 migration';
  END IF;
END $$;
CREATE TYPE "TelemetryOrigin" AS ENUM ('collected', 'submitted');
CREATE TYPE "AlertStatus" AS ENUM ('open', 'acknowledged', 'resolved');
CREATE TABLE "Mission" (
  "id" VARCHAR(100) NOT NULL,
  CONSTRAINT "Mission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Mission_id_format" CHECK ("id" ~ '^[A-Za-z0-9_-]{1,100}$')
);
ALTER TABLE "MissionTelemetry"
  ADD COLUMN "mission" VARCHAR(100) NOT NULL,
  ADD COLUMN "timestamp" TIMESTAMPTZ(3) NOT NULL,
  ADD COLUMN "origin" "TelemetryOrigin" NOT NULL,
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ADD CONSTRAINT "MissionTelemetry_mission_fkey" FOREIGN KEY ("mission") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MissionTelemetry_payload_object" CHECK (jsonb_typeof("payload") = 'object'),
  ADD CONSTRAINT "MissionTelemetry_source_category" CHECK (
    ("source" = 'iss' AND "category" = 'orbit') OR
    ("source" = 'spaceWeather' AND "category" = 'space-weather') OR
    ("source" = 'astronauts' AND "category" = 'crew') OR
    ("source" = 'rocket' AND "category" = 'vehicle') OR
    ("source" = 'nasa' AND "category" = 'nasa') OR
    ("source" = 'mission' AND "category" = 'mission')
  );
ALTER TABLE "AlertEvent"
  ADD COLUMN "status" "AlertStatus" NOT NULL DEFAULT 'open',
  ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "acknowledgedAt" TIMESTAMPTZ(3),
  ADD COLUMN "resolvedAt" TIMESTAMPTZ(3),
  ALTER COLUMN "source" SET DEFAULT 'dashboard',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ADD CONSTRAINT "AlertEvent_id_format" CHECK ("id" ~ '^alert_[a-f0-9]{64}$'),
  ADD CONSTRAINT "AlertEvent_source" CHECK ("source" = 'dashboard'),
  ADD CONSTRAINT "AlertEvent_lifecycle" CHECK (
    ("status" = 'open' AND "acknowledgedAt" IS NULL AND "resolvedAt" IS NULL AND "updatedAt" = "createdAt") OR
    ("status" = 'acknowledged' AND "acknowledgedAt" IS NOT NULL AND "acknowledgedAt" >= "createdAt" AND "resolvedAt" IS NULL AND "updatedAt" = "acknowledgedAt") OR
    ("status" = 'resolved' AND "acknowledgedAt" IS NOT NULL AND "resolvedAt" IS NOT NULL AND "acknowledgedAt" >= "createdAt" AND "resolvedAt" >= "acknowledgedAt" AND "updatedAt" = "resolvedAt")
  );
CREATE INDEX "MissionTelemetry_timestamp_id_idx" ON "MissionTelemetry"("timestamp" DESC, "id");
CREATE INDEX "MissionTelemetry_mission_timestamp_idx" ON "MissionTelemetry"("mission", "timestamp" DESC);
CREATE INDEX "MissionTelemetry_source_timestamp_idx" ON "MissionTelemetry"("source", "timestamp" DESC);
CREATE INDEX "MissionTelemetry_category_timestamp_idx" ON "MissionTelemetry"("category", "timestamp" DESC);
CREATE INDEX "AlertEvent_status_createdAt_id_idx" ON "AlertEvent"("status", "createdAt", "id");
CREATE INDEX "AlertEvent_source_severity_createdAt_idx" ON "AlertEvent"("source", "severity", "createdAt" DESC);
COMMIT;
