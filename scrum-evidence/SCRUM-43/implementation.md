# SCRUMBOARD-43 — Improve Existing Backend Tests

## Coverage added

- Added DatasetService coverage for all supported dataset accessors, typed-key access, and complete bundle loading.
- Added dashboard-service coverage for complete snapshot generation, cache behavior, and crew/vehicle health derivation.
- Added alerts API coverage for the response contract and per-event severity values.
- Added dashboard API integration coverage.
- Added telemetry API integration coverage for live snapshots and history.
- Added dataset API integration coverage for supported keys, mission retrieval, and invalid-key handling.
- Added error-handler integration coverage for the standard 500 response.
- Expanded the permanent Vitest configuration to run the new coverage alongside the existing SCRUM-15 and SCRUM-40 suites.

## Test coverage added

**14 new tests** across DatasetService, dashboard service, alerts API, dashboard API, telemetry API, dataset API, and error handling.

The existing SCRUM-15 and SCRUM-40 suites remain included.

## Design

Tests assert service/API contracts and invariants where possible instead of depending on incidental current dataset values.

## Verification

Pending local verification on the branch.
