import { z } from 'zod';
import type { NasaData, NasaEndpoint, NasaDataByEndpoint } from '../types/externalData.js';

export const nasaDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const webUrl = z.string().url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol), 'Invalid media URL');
const apodSchema = z.object({
  date: nasaDateSchema, title: z.string().min(1).max(2000), explanation: z.string().max(100000),
  media_type: z.enum(['image', 'video', 'iframe']), url: webUrl,
  hdurl: webUrl.nullish(), thumbnail_url: webUrl.nullish(), copyright: z.string().optional()
});
const distance = z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number).pipe(z.number().finite().nonnegative());
const neoSchema = z.object({
  element_count: z.number().int().nonnegative(),
  near_earth_objects: z.record(nasaDateSchema, z.array(z.object({
    id: z.string().min(1), name: z.string().min(1), is_potentially_hazardous_asteroid: z.boolean(),
    close_approach_data: z.array(z.object({ close_approach_date: nasaDateSchema, orbiting_body: z.string(), miss_distance: z.object({ kilometers: distance }) }))
  })).max(10000))
});

export function normalizeNasaData<E extends NasaEndpoint>(endpoint: E, payload: unknown, date: string): NasaDataByEndpoint[E];
export function normalizeNasaData(endpoint: NasaEndpoint, payload: unknown, date: string): NasaData {
  nasaDateSchema.parse(date);
  if (endpoint === 'apod') {
    const apod = apodSchema.parse(payload);
    if (apod.date !== date) throw new Error('Mismatched APOD date');
    return {
      date: apod.date, title: apod.title, explanation: apod.explanation,
      mediaType: apod.media_type, url: apod.url, hdUrl: apod.hdurl ?? null,
      thumbnailUrl: apod.thumbnail_url ?? null, copyright: apod.copyright ?? null
    };
  }
  if (endpoint !== 'asteroids') throw new Error('Unsupported NASA endpoint');
  const feed = neoSchema.parse(payload);
  if (Object.keys(feed.near_earth_objects).some(key => key !== date)) throw new Error('Mismatched feed date');
  const objects = feed.near_earth_objects[date] ?? [];
  if (feed.element_count !== objects.length || new Set(objects.map(item => item.id)).size !== objects.length) throw new Error('Inconsistent feed');
  const approaches = objects.flatMap(item => item.close_approach_data
    .filter(approach => approach.close_approach_date === date && approach.orbiting_body === 'Earth')
    .map(approach => ({ id: item.id, name: item.name, distanceKm: approach.miss_distance.kilometers })));
  // Stable tie-breaking makes equivalent provider ordering produce the same result.
  approaches.sort((a, b) => a.distanceKm - b.distanceKm || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { date, trackedCount: objects.length, hazardousCount: objects.filter(item => item.is_potentially_hazardous_asteroid).length, closestApproach: approaches[0] ?? null };
}
