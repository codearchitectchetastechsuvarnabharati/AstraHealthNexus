# SCRUMBOARD-23 — Alert Severity Management

## Implementation

- Added a centralized alert severity classifier at `server/src/alertSeverity.ts`.
- Supported severity levels are configurable with:
  - `ALERT_SEVERITY_LEVELS`
  - `ALERT_DEFAULT_SEVERITY`
- Added severity classification for:
  - critical/emergency/failure conditions
  - high Kp / space-weather conditions
  - low crew-health and rocket-readiness scores
  - potentially hazardous asteroid conditions
  - warning/anomaly/attention conditions
  - informational alerts by default
- Updated `buildAlertSnapshot()` so every generated alert event contains its derived severity and the top-level response severity reflects the highest generated severity.
- Added permanent unit coverage in `server/src/alertSeverity.test.ts`.
- Updated `server/vitest.config.ts` so the new test executes with the existing test suite.
- Updated `server/tsconfig.json` so Vitest test files are excluded from the production TypeScript build while remaining covered by Vitest.
- Documented the new environment configuration in `.env.example`.

## Verification status

Implementation is committed on branch `scrum-23-alert-severity`.

The first local verification attempt reached the SCRUM-23 branch successfully but stopped during TypeScript build for two local-environment reasons:

1. The new Vitest test file was included in the normal TypeScript build, so Vitest globals such as `describe`, `it`, and `expect` were not available to `tsc`.
2. The local generated Prisma client was stale after switching branches, so `alertsRoutes.ts` referenced `isAcknowledged` before the generated client reflected the existing Prisma schema field.

The branch now contains the TypeScript test-file exclusion fix. The local verification command should regenerate the Prisma client before running the build.

## Final local verification — PASS

The local SCRUM-23 verification completed successfully:

- Git branch matched the remote `scrum-23-alert-severity` branch.
- TypeScript `--noEmit` completed with 0 errors.
- Server production build completed successfully.
- Full configured Vitest suite passed: **3 test files / 11 tests**.
- The new `alertSeverity.test.ts` passed all 4 severity tests.
- Prisma schema and generated client both contained `isAcknowledged` and matched.
- Backend started successfully on port 4000.
- `GET /api/health` returned `status: ok`.
- `GET /api/alerts` returned **7 alert events**.
- Every event contained a valid severity: `info`, `warning`, or `critical`.
- The top-level severity was `warning`.
- The top-level severity matched the highest event severity returned by the API.
- Backend test process was stopped cleanly after runtime verification.

The local verification did not require `DATABASE_URL` for the tested alert snapshot path.

SCRUMBOARD-23 implementation and local verification are complete. PR #14 remains open for team review and has not been merged.