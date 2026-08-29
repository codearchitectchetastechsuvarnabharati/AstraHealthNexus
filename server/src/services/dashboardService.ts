// codeauthor chetas karnam
import { DatasetService } from './datasetService.js';
import { datasetEvents } from './datasetLoader.js';
import { EventEmitter } from 'events';

export interface CrewAndVehicleHealth {
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
}

export interface DashboardSnapshot {
  missionStatus: string;
  orbit: string;
  weather: string;
  alerts: string[];
  telemetry: Array<{ label: string; value: number }>;
  nasaHighlight?: string;
  nasaImage?: string | null;
  lastUpdated: string;
  spaceWeatherStatus: string;
  nasaAsteroidSummary?: string;
  missionObjectives: string[];
  missionCrew: string[];
  spaceWeatherKPIndex: number;
  solarFlux: number;
  crewAndVehicleHealth: CrewAndVehicleHealth;
}

let cachedSnapshot: DashboardSnapshot | null = null;
let lastFetchedAt = 0;

export const snapshotEvents = new EventEmitter();

export function deriveCrewAndVehicleHealth(
  rocket: Awaited<ReturnType<typeof DatasetService.getRocketData>>,
  astronauts: Awaited<ReturnType<typeof DatasetService.getAstronautData>>,
  spaceWeather: Awaited<ReturnType<typeof DatasetService.getSpaceWeatherData>>,
  nasaData: Awaited<ReturnType<typeof DatasetService.getNASAData>>
): CrewAndVehicleHealth {
  const astronautCount = astronauts.length;
  const astronautHealthScore = astronautCount > 0
    ? Math.round(astronauts.reduce((sum, astronaut) => sum + astronaut.healthScore, 0) / astronautCount)
    : 0;
  const rocketHealthScore = Math.round(rocket.healthScore);

  const astronautStatus = astronautHealthScore >= 92 ? 'Stable' : astronautHealthScore >= 84 ? 'Monitor' : 'Attention';
  const rocketStatus = rocketHealthScore >= 92 ? 'Stable' : rocketHealthScore >= 84 ? 'Monitor' : 'Attention';

  const primaryAstronaut = astronauts[0];
  const oxygenLevel = primaryAstronaut?.vitalSigns?.oxygenSaturation ?? 0;
  const heartRate = primaryAstronaut?.vitalSigns?.heartRate ?? 0;
  const cabinPressure = primaryAstronaut?.vitalSigns?.cabinPressure ?? 0;
  const temperature = primaryAstronaut?.vitalSigns?.temperature ?? 0;
  const crewNarrative = astronautCount > 0
    ? `${astronautCount} crew members are ${astronautStatus.toLowerCase()}, with an average oxygen saturation of ${oxygenLevel}% and stable cardiovascular readings.`
    : 'Crew telemetry is unavailable because no astronaut records were loaded.';

  return {
    astronautHealthScore,
    rocketHealthScore,
    astronautStatus,
    rocketStatus,
    astronautNarrative: `ISS crew readiness is ${astronautStatus.toLowerCase()}. ${crewNarrative} ${spaceWeather.description}`,
    rocketNarrative: `Current vehicle systems are ${rocketStatus.toLowerCase()}. Thrust is ${rocket.systems.thrust}%, fuel pressure ${rocket.systems.fuelPressure}%, thermal management ${rocket.systems.thermalManagement}%. ${nasaData.asteroids.summary}`,
    astronautVitalSigns: {
      oxygen: Math.round(oxygenLevel),
      heartRate,
      cabinPressure: Math.round(cabinPressure * 10) / 10,
      temperature: Math.round(temperature * 10) / 10
    },
    rocketSystems: {
      thrust: Math.round(rocket.systems.thrust),
      fuelPressure: Math.round(rocket.systems.fuelPressure),
      thermal: Math.round(rocket.systems.thermalManagement),
      avionics: Math.round(rocket.systems.avionicsHealth)
    }
  };
}

async function generateSnapshot(): Promise<DashboardSnapshot> {
  const [iss, spaceWeather, nasaData, rocket, mission, astronauts] = await Promise.all([
    DatasetService.getISSData(),
    DatasetService.getSpaceWeatherData(),
    DatasetService.getNASAData(),
    DatasetService.getRocketData(),
    DatasetService.getMissionData(),
    DatasetService.getAstronautData()
  ]);

  const latitude = Number(iss.latitude ?? 0);
  const longitude = Number(iss.longitude ?? 0);
  const asteroidSummary = nasaData.asteroids.summary;
  const crewAndVehicleHealth = deriveCrewAndVehicleHealth(rocket, astronauts, spaceWeather, nasaData);

  const weatherDetail = `${spaceWeather.status} • ${spaceWeather.description}`;
  const nasaHighlightText = `${nasaData.apod.title} (${nasaData.apod.date})`;
  const orbitalLockValue = Math.min(
    100,
    Math.max(70, Math.round(100 - Math.abs(iss.altitude - 408.5) * 0.75 - Math.abs(iss.velocity - 27600) / 150))
  );
  const weatherQualityValue = Math.min(
    100,
    Math.max(50, Math.round(100 - (spaceWeather.auroralPower / 6 + spaceWeather.kpIndex * 4)))
  );

  const snapshot: DashboardSnapshot = {
    missionStatus: `ISS - ${mission.missionName} • ${mission.phase}`,
    orbit: `${iss.name} / ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}° • Alt: ${iss.altitude} km`,
    weather: weatherDetail,
    alerts: [
      `NASA APOD: ${nasaData.apod.title}`,
      `ISS position: ${latitude.toFixed(2)}°N, ${Math.abs(longitude).toFixed(2)}°W`,
      asteroidSummary,
      `Space weather KPI: Kp=${spaceWeather.kpIndex}, Solar flux=${spaceWeather.solarFlux}`,
      `Crew health: ${crewAndVehicleHealth.astronautHealthScore}% average across ${astronauts.length} crew`,
      `Rocket readiness: ${rocket.healthScore}% (${rocket.currentStage})`,
      `Mission phase: ${mission.phase}`
    ],
    telemetry: [
      { label: 'Feed sync', value: 100 },
      { label: 'Orbital lock', value: orbitalLockValue },
      { label: 'Space weather', value: weatherQualityValue },
      { label: 'Crew health', value: crewAndVehicleHealth.astronautHealthScore },
      { label: 'Vehicle status', value: crewAndVehicleHealth.rocketHealthScore }
    ],
    nasaHighlight: nasaHighlightText,
    nasaAsteroidSummary: asteroidSummary,
    nasaImage: null,
    lastUpdated: new Date().toISOString(),
    spaceWeatherStatus: weatherDetail,
    missionObjectives: mission.objectives,
    missionCrew: mission.crewManifest,
    spaceWeatherKPIndex: spaceWeather.kpIndex,
    solarFlux: spaceWeather.solarFlux,
    crewAndVehicleHealth
  };

  return snapshot;
}

export async function buildDashboardSnapshot(forceRefresh = false): Promise<DashboardSnapshot> {
  const now = Date.now();
  // Serve cached snapshot by default for high-performance; regenerated when datasets change.
  if (!forceRefresh && cachedSnapshot) {
    return cachedSnapshot;
  }

  const snapshot = await generateSnapshot();
  cachedSnapshot = snapshot;
  lastFetchedAt = now;
  return snapshot;
}

export function getCachedDashboardSnapshot(): DashboardSnapshot | null {
  return cachedSnapshot;
}

// Regenerate the snapshot and notify listeners. Called when dataset files change.
export async function regenerateSnapshot() {
  try {
    const snapshot = await generateSnapshot();
    cachedSnapshot = snapshot;
    lastFetchedAt = Date.now();
    // notify listeners
    try {
      snapshotEvents.emit('snapshotUpdated', snapshot);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[dashboardService] Failed to emit snapshotUpdated', err);
    }
    return snapshot;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[dashboardService] Failed to regenerate snapshot', err);
    throw err;
  }
}

// Recompute snapshot on dataset changes
datasetEvents.on('datasetChanged', async () => {
  // Fire-and-forget; regenerative errors are logged
  regenerateSnapshot().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[dashboardService] regenerateSnapshot error', e);
  });
});

export async function buildAlertSnapshot() {
  const snapshot = await buildDashboardSnapshot(true);
  return {
    summary: 'Local dataset snapshot refreshed',
    severity: 'info',
    events: snapshot.alerts.map((alert) => ({ message: alert, severity: 'info' }))
  };
}
