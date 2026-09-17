# API validation, logging, pagination and failure tests

## Scope

The primary Express API and the optional Python and Java backends are covered. The Java backend compiles and has its own integration suite against a real local HTTP server with isolated temporary datasets.

## Validation and safe errors

Node rejects invalid dataset keys, malformed astronaut identifiers, invalid status filters, malformed timestamps, repeated/array/object pagination arguments, unknown list-query parameters, unsafe integers, and out-of-range limits. Query integers must be decimal strings. Limit defaults to 20, accepts 1–100; offset defaults to 0. Missing a required field is a 400 when its route matches; nonexistent routes are structured 404s.

JSON parse failures return 400; JSON bodies over 100 KB return 413; non-JSON request bodies return 415. Refresh accepts only an empty JSON object or no body. Unexpected server errors return a generic 500 with no internal error text. Details are recorded in server logs.

Python validates dataset keys, astronaut identifiers, limit/offset, refresh bodies, and required dataset structures/types before caching. Files over 2 MB are rejected by all three data loaders. Numeric fields must be finite.

## Pagination

Node list example: `/api/dataset/astronauts?limit=2&offset=0&status=Stable`.

List responses retain `data` or `history` and add `pagination` with `limit`, `offset`, `total`, `returned`, and `hasMore`.

`/api/dataset` pages dataset keys and reports their total. Nested arrays are also paged. Dataset objects, alerts, dashboards, and stream snapshots preserve their data shapes and expose `collections` metadata keyed by the array path. For example `/api/dataset/mission?limit=1&offset=1` pages both objectives and crewManifest, with metadata at `collections.objectives` and `collections.crewManifest`. Limit and offset apply independently to each collection. Use the specific dataset endpoint to page a collection independently of the bundle's keys.

Python pages nested arrays and exposes their paths, such as `collections["data.astronauts"]`. Its fixed set of bundle keys is not paged. Neither implementation mutates the stored dataset while paging. Clients that need later records must request subsequent pages.

## Logging and external services

Node emits JSON log lines for requests, errors, dataset loads/cache invalidation, watcher failures, ingestion, and stream events. Request IDs are server-generated and returned in `X-Request-Id`. Request logs contain method, path without query values, response status and duration. Python emits JSON request, dataset and failure events with request IDs.

The production Node proxy uses a five-second timeout for ordinary upstream responses, rejects responses over 2 MB, preserves SSE streaming, and returns generic 502 responses for connection failures, timeouts and upstream server errors. SSE connections continue until disconnect and do not use the ordinary response-body timeout.

## Running verification

From the project root:

```powershell
npm --prefix server run build
npm --prefix server test
python -m pytest server/tests/test_python_backend.py -q -p no:cacheprovider
```

The Python suite starts an ephemeral local server and edits temporary dataset copies. No separate running backend or edits to the project's mission data are needed.

Tests exercise malformed requests, wrong types, missing required fields, large collections, structured logging, actual route failures, loader read errors, invalid file contents, unreachable upstreams, upstream 500s and timeouts, plus recovery after injected failures.

## Database limitation

Prisma is declared, but the existing APIs do not call a database. The schema explicitly describes future persistence. The Node suite injects a representative Prisma connection exception at the data-service boundary and verifies safe handling. This is a simulated exception test, not proof of a live database outage or recovery. Actual database integration and outage testing require a database-backed service to be implemented/configured first.

## Java backend

Run from the project root:

```powershell
npm --prefix server run build:java
npm --prefix server run test:java
npm --prefix server run start:java
```

The launcher uses JDK 17+ from JAVA_HOME, PATH, or `.tools/java/<jdk>/bin`. A checksum-verified portable JDK 21 is available in this project's `.tools/java` directory. This directory and `server/.java-build` are ignored by Git. The Node supervisor also discovers the portable JDK when START_EXTERNAL_BACKENDS=true.

Java listens on 127.0.0.1:5002 by default. Use `python server/java_cli.py --port 5003` for another port. The test suite selects an available port automatically. Direct Java launches can set `-Dastra.port` and `-Dastra.dataDir` before the class name.

Java rejects malformed JSON, repeated keys, non-finite numbers, excessive JSON nesting, invalid UTF-8, invalid identifiers, repeated/unknown query parameters, unsupported methods and invalid request bodies. Required dataset fields and types are checked before caching. Astronaut datasets are arrays; empty crew arrays produce a valid zero-crew telemetry summary.

Java pagination defaults to 20 items and allows at most 100. Limit and offset apply independently to all nested arrays; metadata appears under `collections`, using paths such as `data.astronauts`. Direct astronaut lists also expose `pagination`. The fixed bundle of dataset keys remains intact. `status=Stable|Monitor|Attention` filters the astronaut list before pagination. GET and POST refresh remain supported for compatibility, with POST preferred.

Java request logs contain timestamp, request ID, method, path, status and duration. Dataset loads, cache refreshes, processing failures and response failures are JSON events. Server failures return a generic 500, and unknown routes return a structured 404. Tests cover oversized/invalid datasets, missing files, recovery, empty crew lists, pagination, malformed bodies and structured logs. Java has no database connection or outbound API calls; those cannot be described as live Java integration tests.
