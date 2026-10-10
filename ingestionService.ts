import { recordTelemetryMeasurements } from './telemetryRecordsService.js';
// codeauthor chetas karnam
import { logger, logServiceFailure, logEvent } from '../middleware/logger.js';
import { buildDashboardSnapshot } from './dashboardService.js';

export interface TelemetryRecord {
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

const history: TelemetryRecord[] = [];

export async function collectTelemetrySnapshot(): Promise<TelemetryRecord> {
  const snapshot = await buildDashboardSnapshot(true);

  const telemetrySnapshot: TelemetryRecord = {
    timestamp: new Date().toISOString(),
    orbit: snapshot.orbit,
    weather: snapshot.weather,
    missionStatus: snapshot.missionStatus,
    nasaHighlight: snapshot.nasaHighlight,
    lastUpdated: snapshot.lastUpdated,
    spaceWeatherStatus: snapshot.spaceWeatherStatus,
    crewAndVehicleHealth: snapshot.crewAndVehicleHealth
  };

  await recordTelemetryMeasurements();
  history.push(telemetrySnapshot);
  if (history.length > 20) {
    history.shift();
  }

  logEvent('telemetry_collected', {
    service: 'ingestion',
    timestamp: telemetrySnapshot.timestamp,
    missionStatus: telemetrySnapshot.missionStatus
  });
  return telemetrySnapshot;
}

export function getTelemetryHistory(): TelemetryRecord[] {
  return history;
}

export function startTelemetryIngestion() {
  const intervalMs = Number(process.env.INGESTION_INTERVAL_MS ?? 1000);
  logEvent('telemetry_ingestion_started', {
    service: 'ingestion',
    intervalMs
  });
  let active = false;
  const timer = setInterval(() => {
    if (active) return; // Skip a tick rather than queue overlapping collection work.
    active = true;
    collectTelemetrySnapshot().catch((error) => {
      logServiceFailure('Telemetry ingestion failed', {
        service: 'ingestion', context: 'telemetry_interval', err: error
      });
    }).finally(() => { active = false; });
  }, intervalMs);
  return () => clearInterval(timer);
}
