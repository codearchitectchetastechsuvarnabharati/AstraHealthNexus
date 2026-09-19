# SCRUM-28: reliable NASA retrieval

## Configuration and endpoints

Set NASA_API_KEY in the project-root .env (or server environment) and restart the Node backend. Obtain your own key at https://api.nasa.gov/. An absent key returns 503; local dataset endpoints and the existing dashboard stream continue to work. Keys are not accepted from query parameters and must not be committed.

- GET /api/nasa/apod?date=2024-09-15 returns validated APOD fields, supporting image, video and iframe entries. Optional hdurl/thumbnail_url become null when absent. URLs remain URLs; HTML and unrecognized fields are not forwarded or executed.
- GET /api/nasa/asteroids?date=2024-09-15 returns a one-day NeoWs summary: trackedCount, hazardousCount and closestApproach (id, name, distanceKm), or null when no matching Earth approach exists. Counts refer to NASA's classification, not a prediction of impact.

Date defaults to today's UTC date. Strict calendar dates from 1995-06-16 through today are accepted. Unknown or repeated query parameters, ranges and invalid dates return 400. Responses include status, data, source, endpoint, date, fetchedAt and cacheStatus.

The existing /api/nasa/stream continues to serve the local dashboard snapshot. These new endpoints retrieve live NASA data on demand; they do not replace local nasa.json, silently mix local and remote values, or change dataset catalog provenance. Python/Java backends are unchanged.

## Reliability

- Requests use fixed HTTPS NASA endpoints, reject redirects, and time out after five seconds (including response reading).
- Connection failures, timeouts and 5xx responses get one retry after 200 ms. 4xx, 429 and invalid responses are not retried immediately.
- Responses must be JSON and at most 2 MB. Required fields, finite nonnegative distances, booleans, dates and feed counts are validated. Inconsistent or malformed data is never cached.
- Successful results are cached for five minutes. Concurrent identical requests share one upstream operation. Cache/failure maps have at most 32 entries each and at most eight distinct upstream operations are in flight.
- For transient failures, successful cached data for the same endpoint/date/key may be used for up to one hour from retrieval. It is explicitly marked cacheStatus=stale with a warning and its original fetchedAt. There is no local-fixture fallback.
- Failures have a 30-second per-query cooldown. A NASA 429 applies Retry-After across both endpoints for that key, with a 60-second default. Repeated calls during cooldown do not repeatedly contact NASA.
- Missing credentials/rate limits/capacity return 503, exhausted timeouts 504, and rejected or malformed upstream responses 502 when no eligible stale result exists. Error payloads use the existing safe error handler.
- Logs include endpoint, reason and retry information. Raw fetch errors, response bodies, credential-bearing URLs and API keys are never logged by this service.

The cache and rate-limit coordination are per Node process. APOD may not yet be published for the requested day; this is reported as an upstream failure, not fabricated data. The integration tests use controlled NASA-format responses and local HTTP servers, not a private API key or NASA's live availability.

## PR files

- server/src/services/nasaService.ts (new)
- server/src/routes/nasaRoutes.ts (modified)
- server/tests/nasaIntegration.test.ts (new)
- server/NASA_INTEGRATION.md (new)

Run npm --prefix server run build and npm --prefix server test from the project root.

## Official references

- NASA APOD documentation: https://github.com/nasa/apod-api
- NASA API documentation: https://github.com/nasa/api-docs and https://api.nasa.gov/
