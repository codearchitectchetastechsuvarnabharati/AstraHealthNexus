import test from 'node:test';
import assert from 'node:assert/strict';
import { DatasetService } from './datasetService.js';
import { deriveCrewAndVehicleHealth } from './dashboardService.js';

test('derives astronaut and rocket health from mission dataset', async () => {
  const astronauts = await DatasetService.getAstronautData();
  const rocket = await DatasetService.getRocketData();
  const spaceWeather = await DatasetService.getSpaceWeatherData();
  const nasaData = await DatasetService.getNASAData();

  const health = deriveCrewAndVehicleHealth(rocket, astronauts, spaceWeather, nasaData);

  assert.ok(health.astronautHealthScore >= 70 && health.astronautHealthScore <= 100);
  assert.ok(health.rocketHealthScore >= 70 && health.rocketHealthScore <= 100);
  assert.ok(['Stable', 'Monitor', 'Attention'].includes(health.astronautStatus));
  assert.ok(['Stable', 'Monitor', 'Attention'].includes(health.rocketStatus));
  assert.ok(health.astronautNarrative.length > 0);
  assert.ok(health.rocketNarrative.length > 0);
  assert.ok(health.astronautVitalSigns.oxygen >= 0 && health.astronautVitalSigns.oxygen <= 100);
  assert.ok(health.astronautVitalSigns.heartRate > 0);
  assert.ok(health.astronautVitalSigns.cabinPressure > 0);
});

test('loads dataset values from local data source and preserves key fields', async () => {
  const allData = await DatasetService.getAllData();

  assert.strictEqual(allData.iss.name, 'International Space Station');
  assert.strictEqual(allData.spaceWeather.status, 'Moderate Solar Activity');
  assert.strictEqual(allData.astronauts.length, 3);
  assert.strictEqual(allData.rocket.name, 'Artemis I Launch Vehicle');
  assert.strictEqual(allData.nasa.apod.date, '2024-09-15');
  assert.strictEqual(allData.mission.missionId, 'ISS-NEXUS-2024');
});
