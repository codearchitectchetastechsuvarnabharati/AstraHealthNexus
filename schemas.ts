import { DATASET_SOURCES, TELEMETRY_CATEGORIES } from './services/datasetCatalog.js';
import { z } from 'zod';

/**
 * Zod schemas for request validation.
 *
 * Mirrors the literal union in client/src/types/api.ts (DatasetKey) and the
 * id format observed in server/src/data-files/astronauts.json (e.g. ast_001).
 */

export const DatasetKeySchema = z.enum([
  'iss',
  'weather',
  'spaceWeather',
  'astronauts',
  'rocket',
  'nasa',
  'mission'
]);

export const AstronautIdSchema = z.string().regex(
  /^ast_\d{3}$/,
  'id must match pattern ast_NNN'
);

/**
 * Pagination schema shared by list-style endpoints.
 *
 * - `limit` is capped at 100 to prevent large payloads from a single request.
 * - `offset` must be a non-negative integer.
 * - Both are coerced from query strings (which arrive as strings) into numbers.
 */
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

const integerQuery = z.string().regex(/^\d+$/, 'must be a non-negative decimal integer').transform(Number).pipe(z.number().int().safe());

export const PaginationQuerySchema = z.object({
  limit: integerQuery.pipe(z.number()
    .int('limit must be an integer')
    .min(1, 'limit must be >= 1')
    .max(MAX_PAGE_LIMIT, `limit must be <= ${MAX_PAGE_LIMIT}`))
    .default(String(DEFAULT_PAGE_LIMIT)),
  offset: integerQuery.default('0')
}).strict();

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Schema for telemetry list queries. Adds pagination plus an optional
 * `since` timestamp filter. Invalid date strings are rejected.
 */
export const TelemetryQuerySchema = PaginationQuerySchema.extend({
  since: z
    .string()
    .datetime({ message: 'since must be an ISO-8601 timestamp' })
    .optional()
});

export type TelemetryQuery = z.infer<typeof TelemetryQuerySchema>;

/**
 * Schema for astronaut list filters.
 *
 * Accepts an optional `status` filter (matched exactly) and the same
 * pagination fields. Status is intentionally limited to a known enum so we
 * don't have to defend against arbitrary strings at the data layer.
 */
export const AstronautListQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['Stable', 'Monitor', 'Attention']).optional()
});

export type AstronautListQuery = z.infer<typeof AstronautListQuerySchema>;


export const TelemetryRecordsQuerySchema = PaginationQuerySchema.extend({
  since: z.string().datetime({ offset: true }).optional(),
  until: z.string().datetime({ offset: true }).optional(),
  source: z.enum(DATASET_SOURCES).optional(),
  category: z.enum(TELEMETRY_CATEGORIES).optional(),
  mission: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/).optional()
}).refine(query => !query.since || !query.until || Date.parse(query.since) <= Date.parse(query.until), {
  path: ['until'], message: 'until must be at or after since'
});
export type TelemetryRecordsQuery = z.infer<typeof TelemetryRecordsQuerySchema>;


const measurementNumber = z.number().finite();
const percentage = measurementNumber.min(0).max(100);
const count = measurementNumber.int().min(0).safe();
const measurementBase = {
  timestamp: z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)), 'Invalid timestamp').transform(value => new Date(value).toISOString()),
  mission: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)
};
export const IncomingTelemetryRecordSchema = z.discriminatedUnion('source', [
  z.object({ ...measurementBase, source: z.literal('iss'), category: z.literal('orbit'), values: z.object({ latitude: measurementNumber.min(-90).max(90), longitude: measurementNumber.min(-180).max(180), altitude: measurementNumber.min(0), velocity: measurementNumber.min(0) }).strict() }).strict(),
  z.object({ ...measurementBase, source: z.literal('spaceWeather'), category: z.literal('space-weather'), values: z.object({ kpIndex: measurementNumber.min(0).max(9), solarFlux: measurementNumber.min(0), solarWindSpeed: measurementNumber.min(0) }).strict() }).strict(),
  z.object({ ...measurementBase, source: z.literal('astronauts'), category: z.literal('crew'), values: z.object({ crewCount: count, averageHealthScore: percentage }).strict() }).strict(),
  z.object({ ...measurementBase, source: z.literal('rocket'), category: z.literal('vehicle'), values: z.object({ healthScore: percentage, thrust: percentage, fuelPressure: percentage }).strict() }).strict(),
  z.object({ ...measurementBase, source: z.literal('nasa'), category: z.literal('nasa'), values: z.object({ hazardousCount: count, trackedToday: count }).strict() }).strict(),
  z.object({ ...measurementBase, source: z.literal('mission'), category: z.literal('mission'), values: z.object({ phase: z.string().trim().min(1).max(200), crewCount: count, objectiveCount: count }).strict() }).strict()
]);
export const TelemetryIntakeSchema = z.object({ records: z.array(IncomingTelemetryRecordSchema).min(1).max(100) }).strict();
export type IncomingTelemetryRecord = z.infer<typeof IncomingTelemetryRecordSchema>;
