import { normalizeNasaData, nasaDateSchema } from './nasaNormalizer.js';
import type { NasaData, NasaEndpoint, ExternalDataResult } from '../types/externalData.js';
import { externalRequest, ExternalRequestError, retryAfterMilliseconds } from './externalRequest.js';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from '../middleware/errors.js';
import { logEvent } from '../middleware/logger.js';

export const NasaQuerySchema = z.object({ date: nasaDateSchema.optional() }).strict();
export type { NasaEndpoint } from '../types/externalData.js';
type FailureReason = 'configuration' | 'timeout' | 'unavailable' | 'rate_limit' | 'invalid_response' | 'upstream_rejected' | 'capacity';
export class NasaError extends HttpError {
  constructor(public readonly reason: FailureReason, public readonly retryAfterSeconds?: number) {
    super(reason === 'timeout' ? 504 : ['configuration', 'rate_limit', 'capacity'].includes(reason) ? 503 : 502, 'NASA data unavailable');
  }
}
type Result = ExternalDataResult<NasaData>;
type Options = {
  fetcher?: typeof fetch; apiKey?: () => string | undefined; now?: () => number;
  timeoutMs?: number; cacheMs?: number; staleMs?: number; retryDelayMs?: number;
  apodCacheMs?: number; asteroidCacheMs?: number; maxCacheEntries?: number; maxCacheBytes?: number;
};

export class NasaService {
  private cache = new Map<string, Result>();
  private inFlight = new Map<string, Promise<Result>>();
  private failures = new Map<string, { until: number; error: NasaError }>();
  private rateLimitedUntil = new Map<string, number>();
  private readonly cachePolicy: { apod: number; asteroids: number; stale: number; entries: number; bytes: number };
  constructor(private readonly options: Options = {}) {
    const setting = (value: number | undefined, env: string | undefined, fallback: number, min: number, max: number) => {
      const parsed = value ?? (env === undefined ? fallback : Number(env));
      if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new RangeError('Invalid NASA cache configuration');
      return parsed;
    };
    this.cachePolicy = {
      apod: setting(options.apodCacheMs ?? options.cacheMs, process.env.NASA_APOD_CACHE_MS, 300000, 0, 86400000),
      asteroids: setting(options.asteroidCacheMs ?? options.cacheMs, process.env.NASA_ASTEROID_CACHE_MS, 300000, 0, 86400000),
      stale: setting(options.staleMs, process.env.NASA_STALE_CACHE_MS, 3600000, 0, 86400000),
      entries: setting(options.maxCacheEntries, undefined, 32, 1, 256),
      bytes: setting(options.maxCacheBytes, undefined, 8 * 1024 * 1024, 1, 32 * 1024 * 1024)
    };
  }
  private pruneCache() {
    for (const [key, value] of this.cache) {
      const age = this.now() - Date.parse(value.fetchedAt);
      if (age < 0 || age >= Math.max(this.cachePolicy[value.endpoint], this.cachePolicy.stale)) this.cache.delete(key);
    }
  }
  private storeCache(key: string, result: Result) {
    this.pruneCache();
    this.cache.delete(key);
    const size = (value: Result) => Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (size(result) > this.cachePolicy.bytes) return;
    this.cache.set(key, result);
    let bytes = [...this.cache.values()].reduce((sum, value) => sum + size(value), 0);
    while (this.cache.size > this.cachePolicy.entries || bytes > this.cachePolicy.bytes) {
      const oldest = this.cache.keys().next().value!;
      bytes -= size(this.cache.get(oldest)!);
      this.cache.delete(oldest);
      logEvent('nasa_cache_evicted', { reason: 'capacity' });
    }
  }
  private now() { return (this.options.now ?? Date.now)(); }

  async get(endpoint: NasaEndpoint, requestedDate?: string): Promise<Result> {
    const date = requestedDate ?? new Date(this.now()).toISOString().slice(0, 10);
    if (!nasaDateSchema.safeParse(date).success || date < '1995-06-16' || date > new Date(this.now()).toISOString().slice(0, 10)) {
      throw new HttpError(400, 'date must be a valid day from 1995-06-16 through today (UTC)');
    }
    const apiKey = (this.options.apiKey?.() ?? process.env.NASA_API_KEY)?.trim();
    if (!apiKey) throw new NasaError('configuration');
    const scope = createHash('sha256').update(apiKey).digest('hex');
    const key = `${scope}:${endpoint}:${date}`;
    this.pruneCache();
    const cached = this.cache.get(key);
    if (cached && this.now() - Date.parse(cached.fetchedAt) < this.cachePolicy[endpoint]) {
      // Refresh recency, never the original retrieval time or freshness window.
      this.cache.delete(key);
      this.cache.set(key, cached);
      logEvent('nasa_cache_hit', { endpoint });
      return structuredClone({ ...cached, cacheStatus: 'cached' });
    }
    const existing = this.inFlight.get(key);
    if (existing) {
      logEvent('nasa_cache_request_shared', { endpoint });
      return structuredClone(await existing);
    }
    const fallback = (error: NasaError): Result => {
      if (cached && ['timeout', 'unavailable', 'rate_limit'].includes(error.reason) && this.now() - Date.parse(cached.fetchedAt) < this.cachePolicy.stale) {
        logEvent('nasa_stale_cache_used', { endpoint, reason: error.reason });
        return { ...cached, cacheStatus: 'stale', warning: 'NASA is temporarily unavailable; previously retrieved data is shown.' };
      }
      throw error;
    };
    const limitedUntil = this.rateLimitedUntil.get(scope) ?? 0;
    if (limitedUntil > this.now()) return structuredClone(fallback(new NasaError('rate_limit', Math.ceil((limitedUntil - this.now()) / 1000))));
    const failed = this.failures.get(key);
    if (failed && failed.until > this.now()) return structuredClone(fallback(failed.error));
    if (this.inFlight.size >= 8) throw new NasaError('capacity');
    logEvent('nasa_cache_miss', { endpoint });
    const request = this.retrieve(endpoint, date, apiKey).then(data => {
      const result: Result = { data, source: 'NASA', endpoint, date, fetchedAt: new Date(this.now()).toISOString(), cacheStatus: 'fresh' };
      this.storeCache(key, result);
      this.failures.delete(key);
      logEvent('nasa_data_retrieved', { endpoint, date });
      return result;
    }).catch((error: NasaError) => {
      // Do not log raw URLs, upstream bodies, or fetch errors: they may contain the API key.
      const safe = error instanceof NasaError ? error : new NasaError('invalid_response');
      logEvent('nasa_request_failed', { endpoint, reason: safe.reason, status: safe.status });
      this.failures.set(key, { until: this.now() + 30000, error: safe });
      this.trim(this.failures);
      if (safe.reason === 'rate_limit') {
        this.rateLimitedUntil.set(scope, this.now() + (safe.retryAfterSeconds ?? 60) * 1000);
        this.trim(this.rateLimitedUntil);
      }
      return fallback(safe);
    }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return structuredClone(await request);
  }

  private trim<T>(map: Map<string, T>) {
    while (map.size > 32) map.delete(map.keys().next().value!);
  }

  private async retrieve(endpoint: NasaEndpoint, date: string, apiKey: string): Promise<NasaData> {
    try {
      return await externalRequest(async signal => {
        const payload = await this.request(endpoint, date, apiKey, signal);
        try {
          return normalizeNasaData(endpoint, payload, date);
        } catch { throw new NasaError('invalid_response'); }
      }, {
        operation: `nasa_${endpoint}`, maxAttempts: 2,
        timeoutMs: this.options.timeoutMs ?? 5000,
        totalTimeoutMs: Math.min((this.options.timeoutMs ?? 5000) * 2 + 1000, 90000),
        baseDelayMs: this.options.retryDelayMs ?? 200,
        shouldRetry: error => error instanceof NasaError && ['timeout', 'unavailable'].includes(error.reason),
        retryAfterMs: error => error instanceof NasaError && error.reason === 'unavailable' && error.retryAfterSeconds !== undefined ? error.retryAfterSeconds * 1000 : undefined
      });
    } catch (error) {
      if (error instanceof ExternalRequestError) throw new NasaError(error.reason === 'timeout' ? 'timeout' : 'unavailable');
      throw error;
    }
  }

  private async request(endpoint: NasaEndpoint, date: string, apiKey: string, signal: AbortSignal): Promise<unknown> {
    const url = new URL(endpoint === 'apod' ? 'https://api.nasa.gov/planetary/apod' : 'https://api.nasa.gov/neo/rest/v1/feed');
    url.searchParams.set('api_key', apiKey);
    if (endpoint === 'apod') { url.searchParams.set('date', date); url.searchParams.set('thumbs', 'true'); }
    else { url.searchParams.set('start_date', date); url.searchParams.set('end_date', date); }
    let response: Response | undefined;
    try {
      response = await (this.options.fetcher ?? fetch)(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal });
      if (response.status === 429) {
        const header = response.headers.get('retry-after');
        const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header) - this.now()) / 1000) : 60;
        throw new NasaError('rate_limit', Number.isFinite(seconds) && seconds > 0 && seconds <= Number.MAX_SAFE_INTEGER / 1000 ? seconds : 60);
      }
      if ([500, 502, 503, 504].includes(response.status)) {
        const wait = retryAfterMilliseconds(response.headers.get('retry-after'));
        throw new NasaError('unavailable', wait === undefined ? undefined : Math.ceil(wait / 1000));
      }
      if (!response.ok) throw new NasaError('upstream_rejected');
      const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (type !== 'application/json') throw new NasaError('invalid_response');
      const reader = response.body?.getReader();
      if (!reader) throw new NasaError('invalid_response');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 2 * 1024 * 1024) throw new NasaError('invalid_response');
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { throw new NasaError('invalid_response'); }
    } catch (error) {
      if (error instanceof NasaError) throw error;
      if (signal.aborted) throw signal.reason;
      throw new NasaError('unavailable');
    } finally {
      void response?.body?.cancel().catch(() => undefined);
    }
  }
}

export const nasaService = new NasaService();
