// codeauthor chetas karnam
import { logger } from '../middleware/logger.js';
import { buildDashboardSnapshot } from './dashboardService.js';

export interface TelemetryRecord {
  id: string;
  timestamp: string;
  orbit: string;
  weather: string;
  missionStatus: string;
  nasaHighlight?: string;
  lastUpdated?: string;
  spaceWeatherStatus?: string;
  crewAndVehicleHealth?: {
    astronautHealthScore: number;
    rocketHealthScore: number;
    astronautStatus: string;
    rocketStatus: string;
    astronautNarrative: string;
    rocketNarrative: string;
    astronautVitalSigns: {
      oxygen: number;
      heartRate: number;
      cabinPressure: number;
      temperature: number;
    };
    rocketSystems: {
      thrust: number;
      fuelPressure: number;
      thermal: number;
      avionics: number;
    };
  };
}

export interface TelemetryQueryOptions {
  from?: string;      // ISO date - filter records after this time
  to?: string;        // ISO date - filter records before this time
  limit?: number;     // max records to return (default 20, max 200)
  offset?: number;    // skip first N records (default 0)
}

export interface TelemetryStats {
  totalRecords: number;
  returnedRecords: number;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
  avgAstronautHealth: number;
  avgRocketHealth: number;
  avgOxygen: number;
  avgHeartRate: number;
  minOxygen: number;
  maxHeartRate: number;
}

const MAX_HISTORY = 500;
const history: TelemetryRecord[] = [];
let nextId = 1;

export async function collectTelemetrySnapshot(): Promise<TelemetryRecord> {
  const snapshot = await buildDashboardSnapshot(true);

  const telemetrySnapshot: TelemetryRecord = {
    id: `tel_${nextId++}`,
    timestamp: new Date().toISOString(),
    orbit: snapshot.orbit,
    weather: snapshot.weather,
    missionStatus: snapshot.missionStatus,
    nasaHighlight: snapshot.nasaHighlight,
    lastUpdated: snapshot.lastUpdated,
    spaceWeatherStatus: snapshot.spaceWeatherStatus,
    crewAndVehicleHealth: snapshot.crewAndVehicleHealth
  };

  history.push(telemetrySnapshot);
  if (history.length > MAX_HISTORY) {
    history.shift();
  }

  logger.info('Collected telemetry snapshot from public aerospace feeds');
  return telemetrySnapshot;
}

/**
 * Get telemetry history with optional filtering and pagination.
 */
export function getTelemetryHistory(options: TelemetryQueryOptions = {}): {
  records: TelemetryRecord[];
  stats: TelemetryStats;
  pagination: { limit: number; offset: number; total: number; returned: number; hasMore: boolean };
} {
  let records = [...history];

  // Filter by from date
  if (options.from) {
    const fromTime = Date.parse(options.from);
    if (!Number.isNaN(fromTime)) {
      records = records.filter((r) => Date.parse(r.timestamp) >= fromTime);
    }
  }

  // Filter by to date
  if (options.to) {
    const toTime = Date.parse(options.to);
    if (!Number.isNaN(toTime)) {
      records = records.filter((r) => Date.parse(r.timestamp) <= toTime);
    }
  }

  const total = records.length;

  // Sort newest first
  records.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  // Apply pagination
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const paged = records.slice(offset, offset + limit);

  // Build stats from the filtered (pre-pagination) records
  const stats = buildStats(records, paged.length);

  return {
    records: paged,
    stats,
    pagination: {
      limit,
      offset,
      total,
      returned: paged.length,
      hasMore: offset + paged.length < total
    }
  };
}

function buildStats(records: TelemetryRecord[], returned: number): TelemetryStats {
  if (records.length === 0) {
    return {
      totalRecords: 0,
      returnedRecords: returned,
      oldestTimestamp: null,
      newestTimestamp: null,
      avgAstronautHealth: 0,
      avgRocketHealth: 0,
      avgOxygen: 0,
      avgHeartRate: 0,
      minOxygen: 0,
      maxHeartRate: 0
    };
  }

  const astronauts = records
    .map((r) => r.crewAndVehicleHealth?.astronautHealthScore)
    .filter((v): v is number => typeof v === 'number');
  const rockets = records
    .map((r) => r.crewAndVehicleHealth?.rocketHealthScore)
    .filter((v): v is number => typeof v === 'number');
  const oxygens = records
    .map((r) => r.crewAndVehicleHealth?.astronautVitalSigns?.oxygen)
    .filter((v): v is number => typeof v === 'number');
  const heartRates = records
    .map((r) => r.crewAndVehicleHealth?.astronautVitalSigns?.heartRate)
    .filter((v): v is number => typeof v === 'number');

  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
  const min = (arr: number[]) => (arr.length ? Math.min(...arr) : 0);
  const max = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);

  const timestamps = records.map((r) => r.timestamp).sort();

  return {
    totalRecords: records.length,
    returnedRecords: returned,
    oldestTimestamp: timestamps[0] ?? null,
    newestTimestamp: timestamps[timestamps.length - 1] ?? null,
    avgAstronautHealth: avg(astronauts),
    avgRocketHealth: avg(rockets),
    avgOxygen: avg(oxygens),
    avgHeartRate: avg(heartRates),
    minOxygen: min(oxygens),
    maxHeartRate: max(heartRates)
  };
}

export function clearHistory(): void {
  history.length = 0;
  nextId = 1;
}

export function startTelemetryIngestion() {
  const intervalMs = Number(process.env.INGESTION_INTERVAL_MS ?? 1000);
  setInterval(() => {
    collectTelemetrySnapshot().catch((error) => logger.error(`Telemetry ingestion failed: ${String(error)}`));
  }, intervalMs);
}