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
- Documented the new environment configuration in `.env.example`.

## Verification status

Implementation is committed on branch `scrum-23-alert-severity`.

Local TypeScript build, test execution, and live API verification still need to be run against the user's local checkout before marking the Scrum fully verified.
