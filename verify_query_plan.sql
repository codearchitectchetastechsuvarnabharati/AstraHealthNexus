-- Representative synthetic data only; all rows are rolled back.
BEGIN;
INSERT INTO "AlertEvent" ("id", "source", "severity", "message", "createdAt", "updatedAt")
SELECT 'alert_' || md5('scrum36-' || g::text) || md5('scrum36-' || g::text), 'dashboard', 'info', 'query plan check',
       '2026-01-01T00:00:00Z'::timestamptz + g * interval '1 second',
       '2026-01-01T00:00:00Z'::timestamptz + g * interval '1 second'
FROM generate_series(1, 10000) g;
ANALYZE "AlertEvent";
DO $$ DECLARE plan JSON; BEGIN
  EXECUTE 'EXPLAIN (FORMAT JSON) SELECT "id" FROM "AlertEvent" ORDER BY "createdAt", "id" LIMIT 20' INTO plan;
  IF plan::text NOT LIKE '%AlertEvent_createdAt_id_idx%' THEN
    RAISE EXCEPTION 'Expected chronological index in alert plan: %', plan;
  END IF;
  IF plan::text LIKE '%"Node Type": "Sort"%' THEN
    RAISE EXCEPTION 'Unexpected sort in alert plan: %', plan;
  END IF;
END $$;
ROLLBACK;
