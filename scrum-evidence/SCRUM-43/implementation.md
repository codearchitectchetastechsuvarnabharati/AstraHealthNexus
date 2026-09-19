# SCRUMBOARD-43 — Improve Existing Backend Tests

## Coverage added

- Added DatasetService coverage for all supported dataset accessors, typed-key access, and complete bundle loading.
- Added dashboard-service coverage for complete snapshot generation, cache behavior, and crew/vehicle health derivation.
- Added alerts API coverage for response contract and per-event severity values.
- Added dashboard API integration coverage.
- Added telemetry API integration coverage for live snapshots and history.
- Added error-handler integration coverage for the standard 500 response.
- Expanded the permanent Vitest configuration to run the new critical backend tests alongside the existing SCRUM-15 and SCRUM-40 suites.

## Design

The tests assert API and service contracts/invariants rather than depending on incidental values wherever possible, so they remain useful as other Scrum items are merged.

## Verification

Pending local verification on the branch.
