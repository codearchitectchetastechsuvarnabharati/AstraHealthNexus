# SCRUM-29: controlled external retries and timeouts

The shared externalRequest helper bounds attempts, response-reading time, total elapsed time and retry delays. It logs retry attempt counts and delays without URLs, credentials or response bodies.

## Policies

- Python/Java proxy GET and HEAD: at most three attempts, five seconds each, 16 seconds total. Delays increase from 200 to 400 milliseconds.
- NASA: at most two attempts, five seconds each, 11 seconds total, minimum 200 milliseconds between attempts. Existing cache, request coalescing, cooldown and stale-result behavior remain in place.
- Retry only connection failures, timeouts and HTTP 500/502/503/504. Retry-After can extend the delay, but never the total budget. If the requested wait does not fit, stop without retrying early.
- Writes and refresh operations receive one attempt. Other HTTP failures and oversized/invalid NASA responses do not retry. NASA 429 uses its existing cooldown; proxy 4xx responses pass through.
- Ordinary response bodies are covered by the attempt timeout and a 2 MB size limit. Failed requests are aborted before retrying. Client disconnects cancel proxy requests and retry waits.
- Successful event streams have a connection timeout only. They stay open after headers; disconnects cancel the stream. Started streams are never replayed automatically.
- Exhausted proxy requests retain the existing safe 502 response. NASA retains its existing 502/503/504 error mapping and eligible stale-cache fallback.

## Files for this PR

- server/src/services/externalRequest.ts (new)
- server/src/services/proxyService.ts (modified)
- server/src/services/nasaService.ts (modified)
- server/tests/externalRequest.test.ts (new)
- server/NASA_INTEGRATION.md (modified)
- server/EXTERNAL_RESILIENCE.md (new)

This task builds on the SCRUM-28 NASA implementation. Include those prerequisite changes in the target branch before merging this PR.

Run npm --prefix server run build and npm --prefix server test from the project root. Tests use controlled responses and local HTTP servers; no external credentials are required.
