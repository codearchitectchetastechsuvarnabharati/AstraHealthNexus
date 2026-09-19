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

Final local build, test execution, backend startup, and live `/api/alerts` verification remain pending.
