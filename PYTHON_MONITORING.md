# SCRUM-33: Python availability monitoring

Node probes Python /health immediately after it starts listening, then every 15 seconds after the preceding probe finishes. A probe has a two-second total timeout, a 16 KB response limit, no retries and no redirects. It uses PYTHON_BACKEND_URL and the SCRUM-32 version/request-ID contract. Probes never overlap; simultaneous API checks share the same operation. Timers do not keep Node alive and the monitor stops when its HTTP server closes or the process exits.

## Main API

GET /api/health/python returns HTTP 200 with status=ok when Python is available, or HTTP 503 with status=degraded when unavailable. It includes dependency:

- service: astrahealth-python
- status: unknown, available or unavailable
- checkedAt: latest completed check time (ISO UTC), initially null
- lastSuccessAt: last successful check time, initially null
- responseTimeMs: latest probe elapsed time, initially null
- consecutiveFailures: resets to zero on recovery
- failure: null or a safe code/message pair

Failure codes: unavailable (connection failure), timeout, http_error (non-200), interface_mismatch (wrong version or request ID), invalid_response (wrong content type, malformed/oversized JSON or incorrect health payload). Raw errors, URLs, credentials and upstream bodies are not exposed. Unavailable responses include Retry-After: 15. All responses use Cache-Control: no-store.

API calls reuse completed checks for 15 seconds; once outdated, the call waits up to two seconds for a shared fresh check. Detection can therefore lag an actual outage or recovery by the polling interval plus probe duration. State transitions/reason changes produce a structured python_availability_changed event.

GET /api/health remains Node liveness and does not fail just because the optional Python service is offline. The monitor neither blocks Python proxy requests nor restarts the service; existing proxy retries/timeouts remain authoritative for individual requests. The Python health probe checks reachability and interface compatibility, not every dataset or the readiness of all operational routes. Monitoring state is per Node process.

## PR files

- server/src/services/pythonMonitor.ts (new)
- server/src/routes/serviceHealthRoutes.ts (new)
- server/src/app.ts (modified)
- server/src/index.ts (modified)
- server/tests/pythonMonitor.test.ts (new)
- server/PYTHON_MONITORING.md (new)

Requires SCRUM-32 on the target branch. Run npm --prefix server run build and npm --prefix server test. Tests cover outages/recovery, concurrent checks, invalid health responses, HTTP failure details, real stalled HTTP connections, periodic polling and cancellation.
