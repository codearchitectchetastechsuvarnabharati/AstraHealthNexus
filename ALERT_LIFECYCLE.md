# Alert lifecycle

This change applies to the primary Node/Express backend. Dashboard and telemetry strings remain unchanged.

## API

- `GET /api/alerts?limit=20&offset=0&status=open`: registers newly observed dashboard alerts as open and returns a paginated list. Status is optional and accepts open, acknowledged or resolved. Existing summary, severity, events and collections fields remain available.
- `GET /api/alerts/:id`: retrieves one previously registered alert.
- `PATCH /api/alerts/:id/status` with JSON `{"status":"acknowledged"}` acknowledges an open alert.
- The same PATCH with `{"status":"resolved"}` resolves an acknowledged alert.

Events now include id, source, status, createdAt, updatedAt, acknowledgedAt and resolvedAt alongside message and severity. Copy the ID from the list response. A missing record returns 404; malformed IDs/bodies/statuses return 400. Skipping acknowledgement or moving backward returns 409. Repeating the current status returns 200 with unchanged timestamps.

## Identity and storage

Alerts match by exact source, message and severity. Identical events are suppressed for a configurable period starting at the most recent matching alert creation (default: five minutes). Repeats do not extend that period or reset status/timestamps, including when the matching alert is acknowledged or resolved. At or after expiry, a matching event creates a new open alert with a distinct ID; the prior alert remains unchanged. A changed message or severity is a different event. Historical alerts remain available even after disappearing from a snapshot. Alerts are registered when the alerts list is requested, as in the existing on-demand snapshot flow. Existing alert IDs and stored records remain compatible.

State is stored in server/runtime/alerts.json and survives process restarts. runtime/ is excluded by server/.gitignore and must not be uploaded. Writes use a temporary file and atomic rename; success is returned only after the write succeeds. Operations in the server process are serialized to avoid lost updates. Unreadable or corrupt state produces a safe 500 instead of resetting alerts. Known alerts can still be retrieved or transitioned while the dataset service is unavailable.

This local-file implementation supports one Node process per state file. Multiple server instances require a shared transactional database. No authentication or actor identity is introduced by this task; existing deployment access controls continue to apply.

## PR scope

Upload only these files for this task:

- server/src/routes/alertsRoutes.ts (modified)
- server/src/services/alertService.ts (new)
- server/tests/alertLifecycle.test.ts (new)
- server/.gitignore (new, unless already present in your GitHub branch)
- server/ALERT_LIFECYCLE.md (new)

The route uses existing validation, pagination schemas, logging and error handling. Ensure those earlier shared dependencies are already in the target branch; this local folder has no Git history, so the GitHub baseline has not been verified.

Run `npm --prefix server run build` and `npm --prefix server test` from the project root.


## SCRUM-27: duplicate alert suppression

Set `ALERT_DEDUP_WINDOW_MS=300000` in the project-root `.env` for a five-minute period, or another positive safe integer in milliseconds. Omission uses five minutes. Invalid values fail alert-list processing rather than silently disabling suppression. Restart the server after changing configuration. This setting is read after the application loads its environment.

The interval is fixed from alert creation: duplicates at 4:59 are suppressed, and a matching event at 5:00 can create a new alert. The same rule applies in a single batch, across requests, and after restarts. Suppression is based on persisted createdAt timestamps, not lifecycle updatedAt timestamps. Concurrent requests within one Node process are serialized; failures to save new alerts do not advance the suppression window. Backward clock changes conservatively preserve suppression until the recorded window expires.

Identity uses exact text, including case and whitespace. Similar-looking messages with changed values are separate events. When snapshots keep reporting an identical event, at most one new matching alert is created per configured window. This is not cross-process deduplication; the single-process storage limit still applies.

For the SCRUM-27 PR, include only:

- server/src/services/alertService.ts (modified)
- server/tests/alertDeduplication.test.ts (new)
- server/ALERT_LIFECYCLE.md (modified)

The earlier lifecycle task is a prerequisite. Do not include runtime alert data in the PR.
