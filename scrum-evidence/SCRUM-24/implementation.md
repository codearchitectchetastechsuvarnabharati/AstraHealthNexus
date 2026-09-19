# SCRUMBOARD-24 — Alert History API

## Implementation

- Added server/src/services/alertHistoryService.ts.
- Uses the existing Prisma AlertEvent model when DATABASE_URL is configured.
- Uses an in-memory fallback for local/offline operation when no database is configured.
- Stores severity, message, source, creation time and acknowledgement state.
- Added GET /api/alerts/history.
- Supports filtering by severity, source, message search text, and date range.
- Supports bounded limit/offset pagination with a maximum page size of 100.
- Returns history newest first.
- Wired generated alert events from buildAlertSnapshot() into history storage.
- Added permanent service and API integration tests.
- Added both history test files to the server Vitest configuration.

## Verification

Pending local branch verification. PR #15 is open and targets the current common `main`.
