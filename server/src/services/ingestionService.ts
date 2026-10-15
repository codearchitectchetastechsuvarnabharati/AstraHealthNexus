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

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------
export type AnomalySeverity = 'warning' | 'critical';

export interface Anomaly {
  field: string;
  value: number;
  expected: string;
  severity: AnomalySeverity;
  message: string;
}

// Configurable thresholds
export const THRESHOLDS = {
  oxygen: { min: 95, criticalMin: 90 },
  heartRate: { min: 50, max: 100, criticalMin: 40, criticalMax: 120 },
  cabinPressure: { min: 98, max: 103, criticalMin: 95, criticalMax: 106 },
  temperature: { min: 36.0, max: 37.5, criticalMin: 35.0, criticalMax: 38.5 },
  astronautHealth: { min: 90, criticalMin: 80 },
  rocketHealth: { min: 90, criticalMin: 80 },
  thrust: { min: 90, criticalMin: 80 },
  fuelPressure: { min: 90, criticalMin: 80 },
  thermal: { min: 90, criticalMin: 80 },
  avionics: { min: 90, criticalMin: 80 }
} as const;

function detectRange(
  field: string,
  value: number | undefined,
  min: number,
  max: number,
  criticalMin: number,
  criticalMax: number
): Anomaly | null {
  if (value === undefined || value === null) return null;

  if (value < criticalMin || value > criticalMax) {
    return {
      field,
      value,
      expected: `${criticalMin} - ${criticalMax}`,
      severity: 'critical',
      message: `${field} is critically out of range: ${value} (expected ${criticalMin}-${criticalMax})`
    };
  }
  if (value < min || value > max) {
    return {
      field,
      value,
      expected: `${min} - ${max}`,
      severity: 'warning',
      message: `${field} is out of expected range: ${value} (expected ${min}-${max})`
    };
  }
  return null;
}

function detectMin(field: string, value: number | undefined, min: number, criticalMin: number): Anomaly | null {
  if (value === undefined || value === null) return null;
  if (value < criticalMin) {
    return {
      field,
      value,
      expected: `>= ${criticalMin}`,
      severity: 'critical',
      message: `${field} is critically low: ${value} (expected >= ${criticalMin})`
    };
  }
  if (value < min) {
    return {
      field,
      value,
      expected: `>= ${min}`,
      severity: 'warning',
      message: `${field} is lower than expected: ${value} (expected >= ${min})`
    };
  }
  return null;
}

export function detectAnomalies(record: TelemetryRecord): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const health = record.crewAndVehicleHealth;
  if (!health) return anomalies;

  const vitals = health.astronautVitalSigns;
  const systems = health.rocketSystems;

  const push = (a: Anomaly | null) => { if (a) anomalies.push(a); };

  // Astronaut vitals
  push(detectMin('astronautVitalSigns.oxygen', vitals?.oxygen, THRESHOLDS.oxygen.min, THRESHOLDS.oxygen.criticalMin));
  push(detectRange('astronautVitalSigns.heartRate', vitals?.heartRate, THRESHOLDS.heartRate.min, THRESHOLDS.heartRate.max, THRESHOLDS.heartRate.criticalMin, THRESHOLDS.heartRate.criticalMax));
  push(detectRange('astronautVitalSigns.cabinPressure', vitals?.cabinPressure, THRESHOLDS.cabinPressure.min, THRESHOLDS.cabinPressure.max, THRESHOLDS.cabinPressure.criticalMin, THRESHOLDS.cabinPressure.criticalMax));
  push(detectRange('astronautVitalSigns.temperature', vitals?.temperature, THRESHOLDS.temperature.min, THRESHOLDS.temperature.max, THRESHOLDS.temperature.criticalMin, THRESHOLDS.temperature.criticalMax));

  // Overall health scores
  push(detectMin('astronautHealthScore', health.astronautHealthScore, THRESHOLDS.astronautHealth.min, THRESHOLDS.astronautHealth.criticalMin));
  push(detectMin('rocketHealthScore', health.rocketHealthScore, THRESHOLDS.rocketHealth.min, THRESHOLDS.rocketHealth.criticalMin));

  // Rocket systems
  push(detectMin('rocketSystems.thrust', systems?.thrust, THRESHOLDS.thrust.min, THRESHOLDS.thrust.criticalMin));
  push(detectMin('rocketSystems.fuelPressure', systems?.fuelPressure, THRESHOLDS.fuelPressure.min, THRESHOLDS.fuelPressure.criticalMin));
  push(detectMin('rocketSystems.thermal', systems?.thermal, THRESHOLDS.thermal.min, THRESHOLDS.thermal.criticalMin));
  push(detectMin('rocketSystems.avionics', systems?.avionics, THRESHOLDS.avionics.min, THRESHOLDS.avionics.criticalMin));

  return anomalies;
}

// ---------------------------------------------------------------------------
// Ingestion + history
// ---------------------------------------------------------------------------
export interface TelemetryRecordWithAnomalies extends TelemetryRecord {
  anomalies: Anomaly[];
  anomalyCount: number;
  worstSeverity: AnomalySeverity | null;
}

const MAX_HISTORY = 500;
const history: TelemetryRecordWithAnomalies[] = [];
let nextId = 1;

export async function collectTelemetrySnapshot(): Promise<TelemetryRecordWithAnomalies> {
  const snapshot = await buildDashboardSnapshot(true);

  const baseRecord: TelemetryRecord = {
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

  const anomalies = detectAnomalies(baseRecord);
  const worstSeverity: AnomalySeverity | null = anomalies.some((a) => a.severity === 'critical')
    ? 'critical'
    : anomalies.length > 0
      ? 'warning'
      : null;

  const record: TelemetryRecordWithAnomalies = {
    ...baseRecord,
    anomalies,
    anomalyCount: anomalies.length,
    worstSeverity
  };

  history.push(record);
  if (history.length > MAX_HISTORY) {
    history.shift();
  }

  if (anomalies.length > 0) {
    logger.warn(`Telemetry anomalies detected: ${anomalies.length} (${worstSeverity})`);
  }
  logger.info('Collected telemetry snapshot from public aerospace feeds');
  return record;
}

export function getTelemetryHistory(): TelemetryRecordWithAnomalies[] {
  return history;
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