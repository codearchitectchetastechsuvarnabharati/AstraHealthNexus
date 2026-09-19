import { describe, expect, it } from 'vitest';
import { DatasetService } from './datasetService.js';

describe('DatasetService', () => {
  it('loads every supported dataset individually', async () => {
    const [iss, spaceWeather, astronauts, rocket, nasa, mission] =
      await Promise.all([
        DatasetService.getISSData(),
        DatasetService.getSpaceWeatherData(),
        DatasetService.getAstronautData(),
        DatasetService.getRocketData(),
        DatasetService.getNASAData(),
        DatasetService.getMissionData()
      ]);

    expect(iss.name).toBe('International Space Station');
    expect(spaceWeather.status).toBeTruthy();
    expect(astronauts.length).toBeGreaterThan(0);
    expect(rocket.name).toBeTruthy();
    expect(nasa.apod.title).toBeTruthy();
    expect(mission.missionName).toBeTruthy();
  });

  it('loads datasets through typed keys', async () => {
    const keys = ['iss', 'spaceWeather', 'astronauts', 'rocket', 'nasa', 'mission'] as const;

    for (const key of keys) {
      const value = await DatasetService.getDatasetByKey(key);
      expect(value).toBeDefined();
    }
  });

  it('loads the complete dataset bundle', async () => {
    const allData = await DatasetService.getAllData();

    expect(Object.keys(allData).sort()).toEqual([
      'astronauts',
      'iss',
      'mission',
      'nasa',
      'rocket',
      'spaceWeather'
    ]);
  });
});
