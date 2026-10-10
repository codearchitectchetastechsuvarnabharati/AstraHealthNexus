import { TelemetryIntakeSchema } from '../schemas.js';
import { HttpError } from '../middleware/errors.js';
import { logEvent } from '../middleware/logger.js';
import { DatasetService } from './datasetService.js';
import { DATASET_CATALOG, DATASET_SOURCES } from './datasetCatalog.js';
import type { DatasetBundle, DatasetKey } from '../types/dataset.js';
import type { TelemetryRecordsQuery } from '../schemas.js';

export interface TelemetryMeasurement {
  timestamp: string;
  receivedAt: string;
  origin: 'collected' | 'submitted';
  source: DatasetKey;
  category: string;
  mission: string;
  values: Record<string, string | number>;
}
export const TELEMETRY_RETENTION = 1200;
export class TelemetryRecordStore {
  private records: TelemetryMeasurement[] = [];
  private ordered?: { record: TelemetryMeasurement; time: number }[];
  private orderedRecords() {
    // Keep insertion retention separate from observation-time ordering.
    return this.ordered ??= this.records.map((record, index) => ({ record, index, time: Date.parse(record.timestamp) }))
      .sort((a, b) => b.time - a.time || b.index - a.index);
  }
  ingest(input: unknown, requestId?: string) {
    // Validate the entire batch before modifying history, including service callers.
    const result = TelemetryIntakeSchema.safeParse(input);
    if (!result.success) throw new HttpError(400, 'Invalid telemetry records', result.error);
    const receivedAt = new Date().toISOString();
    const records: TelemetryMeasurement[] = result.data.records.map(record => ({ ...record, receivedAt, origin: 'submitted' }));
    // Build the new state first so processing failures cannot leave a partial batch.
    const next = [...this.records, ...records].slice(-TELEMETRY_RETENTION);
    logEvent('telemetry_batch_processed', { requestId, accepted: records.length, retainedRecords: next.length });
    this.records = next;
    this.ordered = undefined;
    return { accepted: records.length, receivedAt, retention: { storage: 'memory', maxRecords: TELEMETRY_RETENTION, retainedRecords: next.length } };
  }
  record(bundle: DatasetBundle, timestamp = new Date().toISOString()) {
    const values: Record<DatasetKey, TelemetryMeasurement['values']> = {
      iss: { latitude: bundle.iss.latitude, longitude: bundle.iss.longitude, altitude: bundle.iss.altitude, velocity: bundle.iss.velocity },
      spaceWeather: { kpIndex: bundle.spaceWeather.kpIndex, solarFlux: bundle.spaceWeather.solarFlux, solarWindSpeed: bundle.spaceWeather.solarWindSpeed },
      astronauts: { crewCount: bundle.astronauts.length, averageHealthScore: bundle.astronauts.length ? bundle.astronauts.reduce((sum, crew) => sum + crew.healthScore, 0) / bundle.astronauts.length : 0 },
      rocket: { healthScore: bundle.rocket.healthScore, thrust: bundle.rocket.systems.thrust, fuelPressure: bundle.rocket.systems.fuelPressure },
      nasa: { hazardousCount: bundle.nasa.asteroids.hazardousCount, trackedToday: bundle.nasa.asteroids.trackedToday },
      mission: { phase: bundle.mission.phase, crewCount: bundle.mission.crewManifest.length, objectiveCount: bundle.mission.objectives.length }
    };
    this.ordered = undefined;
    for (const source of DATASET_SOURCES) this.records.push({ timestamp, receivedAt: new Date().toISOString(), origin: 'collected', source, category: DATASET_CATALOG[source].category, mission: bundle.mission.missionId, values: values[source] });
    if (this.records.length > TELEMETRY_RETENTION) this.records.splice(0, this.records.length - TELEMETRY_RETENTION);
  }
  query(query: TelemetryRecordsQuery) {
    const ordered = this.orderedRecords();
    const since = query.since ? Date.parse(query.since) : -Infinity;
    const until = query.until ? Date.parse(query.until) : Infinity;
    const data: TelemetryMeasurement[] = [];
    let total = 0;
    for (const { record, time } of ordered) {
      if (time < since) break;
      if (time > until || (query.source && record.source !== query.source)
        || (query.category && record.category !== query.category) || (query.mission && record.mission !== query.mission)) continue;
      if (total >= query.offset && data.length < query.limit) data.push(record);
      total++;
    }
    return structuredClone({ data, pagination: { limit: query.limit, offset: query.offset, total, returned: data.length, hasMore: query.offset + data.length < total },
      retention: { storage: 'memory', maxRecords: TELEMETRY_RETENTION, retainedRecords: this.records.length,
        oldestTimestamp: ordered.length ? new Date(ordered[ordered.length - 1].time).toISOString() : null,
        newestTimestamp: ordered.length ? new Date(ordered[0].time).toISOString() : null } });
  }

  missions() { return [...new Set(this.records.map(record => record.mission))]; }
}
export const telemetryRecords = new TelemetryRecordStore();
export async function recordTelemetryMeasurements() {
  telemetryRecords.record(await DatasetService.getAllData());
}
