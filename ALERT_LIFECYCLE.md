# Alert lifecycle

This change applies to the primary Node/Express backend. Dashboard and telemetry strings remain unchanged.

## API

- `GET /api/alerts?limit=20&offset=0&status=open`: registers newly observed dashboard alerts as open and returns a paginated list. Status is optional and accepts open, acknowledged or resolved. Existing summary, severity, events and collections fields remain available.
- `GET /api/alerts/:id`: retrieves one previously registered alert.
- `PATCH /api/alerts/:id/status` with JSON `{"status":"acknowledged"}` acknowledges an open alert.
- The same PATCH with `{"status":"resolved"}` resolves an acknowledged alert.

Events now include id, source, status, createdAt, updatedAt, acknowledgedAt and resolvedAt alongside message and severity. Copy the ID from the list response. A missing record returns 404; malformed IDs/bodies/statuses return 400. Skipping acknowledgement or moving backward returns 409. Repeating the current status returns 200 with unchanged timestamps.

## Identity and storage

An alert ID is a deterministic hash of its source, message and severity. Repeated snapshots do not reset status or create duplicates. A changed message or severity becomes a new open alert. Historical alerts remain available even after disappearing from a snapshot. Resolved alerts do not reopen automatically when an identical message is seen again. Alerts are registered when the alerts list is requested, as in the existing on-demand snapshot flow.

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
