import { createHash } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from '../middleware/errors.js';
import { logEvent } from '../middleware/logger.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
export const NasaQuerySchema = z.object({ date: day.optional() }).strict();
const webUrl = z.string().url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol), 'Invalid media URL');
const apodSchema = z.object({
  date: day, title: z.string().min(1).max(2000), explanation: z.string().max(100000),
  media_type: z.enum(['image', 'video', 'iframe']), url: webUrl,
  hdurl: webUrl.nullish(), thumbnail_url: webUrl.nullish(), copyright: z.string().optional()
});
const distance = z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number).pipe(z.number().finite().nonnegative());
const neoSchema = z.object({
  element_count: z.number().int().nonnegative(),
  near_earth_objects: z.record(day, z.array(z.object({
    id: z.string().min(1), name: z.string().min(1), is_potentially_hazardous_asteroid: z.boolean(),
    close_approach_data: z.array(z.object({ close_approach_date: day, orbiting_body: z.string(), miss_distance: z.object({ kilometers: distance }) }))
  })).max(10000))
});
export type NasaEndpoint = 'apod' | 'asteroids';
type FailureReason = 'configuration' | 'timeout' | 'unavailable' | 'rate_limit' | 'invalid_response' | 'upstream_rejected' | 'capacity';
export class NasaError extends HttpError {
  constructor(public readonly reason: FailureReason, public readonly retryAfterSeconds?: number) {
    super(reason === 'timeout' ? 504 : ['configuration', 'rate_limit', 'capacity'].includes(reason) ? 503 : 502, 'NASA data unavailable');
  }
}
type Result = { data: unknown; source: 'NASA'; endpoint: NasaEndpoint; date: string; fetchedAt: string; cacheStatus: 'fresh' | 'cached' | 'stale'; warning?: string };
type Options = {
  fetcher?: typeof fetch; apiKey?: () => string | undefined; now?: () => number;
  timeoutMs?: number; cacheMs?: number; staleMs?: number; retryDelayMs?: number;
};

export class NasaService {
  private cache = new Map<string, Result>();
  private inFlight = new Map<string, Promise<Result>>();
  private failures = new Map<string, { until: number; error: NasaError }>();
  private rateLimitedUntil = new Map<string, number>();
  constructor(private readonly options: Options = {}) {}
  private now() { return (this.options.now ?? Date.now)(); }

  async get(endpoint: NasaEndpoint, requestedDate?: string): Promise<Result> {
    const date = requestedDate ?? new Date(this.now()).toISOString().slice(0, 10);
    if (!day.safeParse(date).success || date < '1995-06-16' || date > new Date(this.now()).toISOString().slice(0, 10)) {
      throw new HttpError(400, 'date must be a valid day from 1995-06-16 through today (UTC)');
    }
    const apiKey = (this.options.apiKey?.() ?? process.env.NASA_API_KEY)?.trim();
    if (!apiKey) throw new NasaError('configuration');
    const scope = createHash('sha256').update(apiKey).digest('hex');
    const key = `${scope}:${endpoint}:${date}`;
    const cached = this.cache.get(key);
    if (cached && this.now() - Date.parse(cached.fetchedAt) < (this.options.cacheMs ?? 300000)) return structuredClone({ ...cached, cacheStatus: 'cached' });
    const existing = this.inFlight.get(key);
    if (existing) return structuredClone(await existing);
    const fallback = (error: NasaError): Result => {
      if (cached && ['timeout', 'unavailable', 'rate_limit'].includes(error.reason) && this.now() - Date.parse(cached.fetchedAt) < (this.options.staleMs ?? 3600000)) {
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
    const request = this.retrieve(endpoint, date, apiKey).then(data => {
      const result: Result = { data, source: 'NASA', endpoint, date, fetchedAt: new Date(this.now()).toISOString(), cacheStatus: 'fresh' };
      this.cache.delete(key);
      this.cache.set(key, result);
      this.trim(this.cache);
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

  private async retrieve(endpoint: NasaEndpoint, date: string, apiKey: string): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      try {
        const payload = await this.request(endpoint, date, apiKey);
        try {
          if (endpoint === 'apod') {
            const apod = apodSchema.parse(payload);
            if (apod.date !== date) throw new Error('Mismatched APOD date');
            return { ...apod, hdurl: apod.hdurl ?? null, thumbnail_url: apod.thumbnail_url ?? null };
          }
          const feed = neoSchema.parse(payload);
          const dates = Object.keys(feed.near_earth_objects);
          if (dates.some(key => key !== date)) throw new Error('Mismatched feed date');
          const objects = feed.near_earth_objects[date] ?? [];
          if (feed.element_count !== objects.length || new Set(objects.map(item => item.id)).size !== objects.length) throw new Error('Inconsistent feed');
          const approaches = objects.flatMap(item => item.close_approach_data
            .filter(approach => approach.close_approach_date === date && approach.orbiting_body === 'Earth')
            .map(approach => ({ id: item.id, name: item.name, distanceKm: approach.miss_distance.kilometers })));
          approaches.sort((a, b) => a.distanceKm - b.distanceKm);
          return { date, trackedCount: objects.length, hazardousCount: objects.filter(item => item.is_potentially_hazardous_asteroid).length, closestApproach: approaches[0] ?? null };
        } catch { throw new NasaError('invalid_response'); }
      } catch (error) {
        const safe = error instanceof NasaError ? error : new NasaError('unavailable');
        if (attempt >= 1 || !['timeout', 'unavailable'].includes(safe.reason)) throw safe;
        logEvent('nasa_request_retry', { endpoint, attempt: attempt + 1, reason: safe.reason });
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelayMs ?? 200));
      }
    }
  }

  private async request(endpoint: NasaEndpoint, date: string, apiKey: string): Promise<unknown> {
    const url = new URL(endpoint === 'apod' ? 'https://api.nasa.gov/planetary/apod' : 'https://api.nasa.gov/neo/rest/v1/feed');
    url.searchParams.set('api_key', apiKey);
    if (endpoint === 'apod') { url.searchParams.set('date', date); url.searchParams.set('thumbs', 'true'); }
    else { url.searchParams.set('start_date', date); url.searchParams.set('end_date', date); }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 5000);
    let response: Response | undefined;
    try {
      response = await (this.options.fetcher ?? fetch)(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: controller.signal });
      if (response.status === 429) {
        const header = response.headers.get('retry-after');
        const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header) - this.now()) / 1000) : 60;
        throw new NasaError('rate_limit', Number.isFinite(seconds) && seconds > 0 && seconds <= Number.MAX_SAFE_INTEGER / 1000 ? seconds : 60);
      }
      if (response.status >= 500) throw new NasaError('unavailable');
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
      throw new NasaError(controller.signal.aborted ? 'timeout' : 'unavailable');
    } finally {
      clearTimeout(timer);
      controller.abort();
      await response?.body?.cancel().catch(() => undefined);
    }
  }
}

export const nasaService = new NasaService();
