# SCRUM-31: consistent external data format

The NASA adapter validates provider payloads and converts them into explicit internal types before cache storage. Network retrieval/retries remain in nasaService.ts; provider validation and field conversion live in nasaNormalizer.ts. Types live in src/types/externalData.ts.

## APOD mapping and compatibility

The live /api/nasa/apod endpoint now returns these internal data fields:

- date: calendar date in YYYY-MM-DD format, matching the request.
- title, explanation, url: validated source values.
- mediaType: image, video or iframe (from media_type).
- hdUrl: HTTP(S) URL or null (from hdurl).
- thumbnailUrl: HTTP(S) URL or null (from thumbnail_url).
- copyright: source attribution or null when absent.

This changes the live APOD response: consumers using media_type, hdurl or thumbnail_url must use mediaType, hdUrl and thumbnailUrl. Unknown provider fields and HTML are excluded. No current client code uses the live APOD/asteroid endpoints. The separate local NASA dataset and dashboard remain unchanged; their fixture fields are not replaced with remote values.

## Asteroids

The live /api/nasa/asteroids data format retains date, trackedCount, hazardousCount and closestApproach. closestApproach contains id, name and numeric distanceKm, or null when no matching Earth approach exists. Numeric provider distance strings are converted to finite nonnegative kilometres, without rounding or converting to millions of kilometres. Equal distances are ordered by ID so provider record order does not affect the selected result. Hazardous counts use NASA's classification.

## Shared behavior

Both responses retain status=success plus source, endpoint, date, fetchedAt, cacheStatus and an optional stale warning. Dates remain date-only values; fetchedAt is an ISO UTC retrieval timestamp. Missing observations are null rather than fabricated zero distances. Invalid values, duplicate asteroid IDs, mismatched dates and inconsistent counts fail safely before caching. Conversion failures use the existing invalid_response handling and are not retried.

Fresh, cached and stale results all contain the same normalized data shape. Proxy responses from the project's own Python/Java backends remain transparent; this adapter handles third-party NASA formats.

## Files for the PR

- server/src/types/externalData.ts (new)
- server/src/services/nasaNormalizer.ts (new)
- server/src/services/nasaService.ts (modified)
- server/tests/nasaNormalizer.test.ts (new)
- server/tests/nasaIntegration.test.ts (modified)
- server/tests/nasaCache.test.ts (modified)
- server/NASA_INTEGRATION.md (modified)
- server/EXTERNAL_NORMALIZATION.md (new)

Requires the preceding NASA integration, retries and cache tasks on the target branch. Run npm --prefix server run build and npm --prefix server test to verify.
