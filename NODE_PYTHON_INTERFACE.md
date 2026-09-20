# SCRUM-32: Node/Python interface v1

Node exposes the Python backend through /api/external/python. The suffix is forwarded unchanged: /api/external/python/api/dataset/iss maps to Python /api/dataset/iss. Node uses PYTHON_BACKEND_URL (default http://127.0.0.1:5001), read at startup. Set an HTTP(S) origin without a path, query, fragment or credentials. Python continues to listen on 127.0.0.1:5001 when started normally.

## Requests

- GET /health: status=ok, service=astrahealth-python.
- GET /api/dataset/keys: status=success, keys array.
- GET /api/dataset: status=success, data object.
- GET /api/dataset/{key}: status=success, data object; astronauts returns an array.
- GET /api/dataset/astronauts/{id}: status=success, data object; ID format ast_NNN.
- GET /api/telemetry/live: status=success, data object.
- GET /api/nasa/stream: text/event-stream with data: JSON snapshot events.
- POST /api/dataset/refresh: empty body or {}, no query parameters; status=success, message string. Legacy GET refresh remains supported and is never retried.

Keys: iss, spaceWeather, astronauts, rocket, nasa, mission. GET supports limit (1..100, default 20) and offset (nonnegative safe integer, default 0). Unknown/repeated parameters fail with 400. GET bodies are rejected by Node. Collections use the existing recursive pagination metadata: limit, offset, total, returned, hasMore. Unknown routes return 404 and unsupported methods 405 before Python is called. Node's existing JSON parser enforces application/json and the 100 KB request limit.

## Versioning and correlation

Node sends X-Astra-Interface-Version: 1 and its generated X-Request-Id. Python echoes both on JSON and stream responses, using the same request ID in structured logs. Direct Python clients may omit version (defaults to 1); unsupported versions return 400 before operations run. Direct request IDs must contain 1..128 ASCII letters, digits, underscores or hyphens; otherwise Python generates a UUID.

Node rejects mismatched/missing interface headers, invalid JSON/UTF-8, content-type mismatches, incorrect success/error envelopes and incorrect top-level data types as a safe 502. JSON errors have status=error and a message string. Contract validation covers the transport envelope and pagination metadata; Python's dataset loader owns individual dataset field validation. Stream headers are validated before forwarding; event bodies remain the existing snapshot format and are not buffered or revalidated by Node.

## Reliability and rollout

Existing SCRUM-29 timeouts, 2 MB response cap, bounded retries and disconnect cancellation apply. Contract errors are permanent and are not retried. Reads may retry temporary connection/500/502/503/504 failures; POST and refresh do not. Python sockets use a 10-second I/O timeout. Streams are never replayed automatically. Responses are not cached.

Deploy/restart the updated Python service before Node: the new Node adapter intentionally rejects an older Python service without v1 headers. Java and NASA integration policies are unchanged. PYTHON_BACKEND_URL is trusted server configuration, not a user-supplied URL. This is a service contract, not authentication; the default Python binding remains loopback.

## PR files

- server/src/app.ts (modified)
- server/src/services/pythonIntegration.ts (new)
- server/src/services/proxyService.ts (modified)
- server/python_backend.py (modified)
- server/tests/pythonIntegration.test.ts (new)
- server/tests/test_python_backend.py (modified)
- server/NODE_PYTHON_INTERFACE.md (new)

Verification: npm --prefix server run build; npm --prefix server test; python -m pytest server/tests/test_python_backend.py -q -p no:cacheprovider. Node integration tests start an isolated Python HTTP server on a dynamically allocated local port, so Python must be on PATH.
