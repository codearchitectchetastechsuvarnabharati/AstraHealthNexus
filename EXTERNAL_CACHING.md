# SCRUM-30: external data caching

NASA APOD and asteroid responses use a bounded in-memory cache. The Python/Java proxy and live event streams are deliberately uncached because they serve operational data and refresh actions.

## Configuration

Set these optional environment variables before starting the Node backend:

- NASA_APOD_CACHE_MS: APOD freshness, default 300000 (five minutes).
- NASA_ASTEROID_CACHE_MS: asteroid freshness, default 300000.
- NASA_STALE_CACHE_MS: maximum age for fallback during temporary failures, default 3600000 (one hour from original retrieval).

Values must be whole milliseconds from 0 to 86400000. Invalid configuration fails at startup. Zero freshness disables fresh-cache hits for that endpoint; zero stale retention disables stale fallback. Disable both for no cached responses. Simultaneous identical requests still share an upstream request.

## Behavior

Only successfully validated NASA data enters the cache. Keys separate endpoint, date and a hash of the API key. Removing credentials prevents cache use. Query validation still runs before cache lookup. Caller mutations cannot change stored data.

Reads preserve fetchedAt and do not extend the freshness period. At expiry the next request fetches fresh data, sharing that operation with concurrent callers. Defaults retain at most 32 entries and 8 MB of serialized UTF-8 data; this is a payload limit, not an exact process heap limit. Least recently used entries are evicted first. Fully expired entries are removed on subsequent access. Entries larger than the budget are returned successfully but not retained.

Transient failures may return prior data only within the configured stale age, marked cacheStatus=stale with a warning. Malformed responses and permanent failures do not become cached data. Existing failure cooldowns remain separate from the data cache. API responses keep Cache-Control: no-store so browser caches cannot bypass server freshness/error handling.

Structured events record hits, misses, shared requests and capacity evictions without credentials or full URLs. Cache contents are process-local and disappear on restart; multiple backend processes do not share a cache.

## PR files

- server/src/services/nasaService.ts (modified)
- server/tests/nasaCache.test.ts (new)
- server/NASA_INTEGRATION.md (modified)
- server/EXTERNAL_CACHING.md (new)

Requires the SCRUM-28 NASA implementation and SCRUM-29 retry helper on the target branch.

Verify with npm --prefix server run build and npm --prefix server test. Tests cover freshness boundaries, per-endpoint expiry, entry/byte eviction, concurrent refreshes, key/date isolation, mutation isolation, stale expiry and configuration validation using controlled responses.
