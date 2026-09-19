import { describe, expect, it } from 'vitest';
import {
  buildDashboardSnapshot,
  deriveCrewAndVehicleHealth,
  getCachedDashboardSnapshot
} from './dashboardService.js';
import { DatasetService } from './datasetService.js';

describe('dashboardService critical coverage', () => {
  it('builds a complete dashboard snapshot with required operational fields', async () => {
    const snapshot = await buildDashboardSnapshot(true);

    expect(snapshot.missionStatus).toBeTruthy();
    expect(snapshot.orbit).toBeTruthy();
    expect(snapshot.weather).toBeTruthy();
    expect(Array.isArray(snapshot.alerts)).toBe(true);
    expect(snapshot.alerts.length).toBeGreaterThan(0);
    expect(Array.isArray(snapshot.telemetry)).toBe(true);
    expect(snapshot.telemetry.length).toBeGreaterThan(0);
    expect(snapshot.lastUpdated).toBeTruthy();
    expect(snapshot.spaceWeatherKPIndex).toBeGreaterThanOrEqual(0);
    expect(snapshot.crewAndVehicleHealth.astronautHealthScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.crewAndVehicleHealth.rocketHealthScore).toBeGreaterThanOrEqual(0);
  });

  it('returns the generated snapshot from the cache', async () => {
    const snapshot = await buildDashboardSnapshot(true);
    expect(getCachedDashboardSnapshot()).toEqual(snapshot);
  });

  it('derives stable/monitor/attention states from health inputs', async () => {
    const [rocket, astronauts, spaceWeather, nasaData] = await Promise.all([
      DatasetService.getRocketData(),
      DatasetService.getAstronautData(),
      DatasetService.getSpaceWeatherData(),
      DatasetService.getNASAData()
    ]);

    const result = deriveCrewAndVehicleHealth(
      rocket,
      astronauts,
      spaceWeather,
      nasaData
    );

    expect(['Stable', 'Monitor', 'Attention']).toContain(result.astronautStatus);
    expect(['Stable', 'Monitor', 'Attention']).toContain(result.rocketStatus);
    expect(result.astronautNarrative.length).toBeGreaterThan(0);
    expect(result.rocketNarrative.length).toBeGreaterThan(0);
    expect(result.astronautVitalSigns.oxygen).toBeGreaterThanOrEqual(0);
    expect(result.rocketSystems.avionics).toBeGreaterThanOrEqual(0);
  });
});
