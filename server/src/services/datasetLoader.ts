import { readFile, stat } from 'fs/promises';
import { watch } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import type { DatasetBundle, DatasetKey } from '../types/dataset.js';

const DATA_FOLDER_PATH = path.resolve(fileURLToPath(new URL('../data-files/', import.meta.url)));

const DATASET_FILE_NAMES: Record<DatasetKey, string> = {
  iss: 'iss.json',
  spaceWeather: 'spaceWeather.json',
  astronauts: 'astronauts.json',
  rocket: 'rocket.json',
  nasa: 'nasa.json',
  mission: 'mission.json'
};

type DatasetCacheEntry = {
  data: unknown;
  mtimeMs: number;
};

function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string`);
  }
}

function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`${name} must be a valid number`);
  }
}

const datasetCache: Partial<Record<DatasetKey, DatasetCacheEntry>> = {};

// Watcher utilities: automatically clear cache entries when dataset files change on disk.
// This ensures the server observes edits immediately without needing manual refresh calls.
const fileChangeTimers: Map<string, NodeJS.Timeout> = new Map();

function keyFromFilename(filename: string): DatasetKey | null {
  for (const k of Object.keys(DATASET_FILE_NAMES)) {
    if (DATASET_FILE_NAMES[k as DatasetKey] === filename) return k as DatasetKey;
  }
  return null;
}

function scheduleClearForKey(key: DatasetKey) {
  // Debounce rapid filesystem events per-key
  const timerKey = key;
  if (fileChangeTimers.has(timerKey)) {
    clearTimeout(fileChangeTimers.get(timerKey)!);
  }
  const t = setTimeout(() => {
    if (datasetCache[key]) {
      delete datasetCache[key];
      // eslint-disable-next-line no-console
      console.info(`[DatasetLoader] Cleared cache for key '${key}' due to file change`);
    }
    // Emit an event so other services (dashboard) can regenerate cached snapshots even if cache was empty
    try {
      datasetEvents.emit('datasetChanged', key);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[DatasetLoader] Failed to emit datasetChanged event', err);
    }
    fileChangeTimers.delete(timerKey);
  }, 250);
  fileChangeTimers.set(timerKey, t);
}

function startFileWatcher() {
  try {
    const watcher = watch(DATA_FOLDER_PATH, { persistent: false }, (eventType, fname) => {
      if (!fname) return;
      const filename = String(fname);
      // Only handle .json files that are part of our dataset map
      if (!filename.toLowerCase().endsWith('.json')) return;
      const key = keyFromFilename(filename);
      if (!key) return;
      // On rename or change, schedule cache clear for that key
      scheduleClearForKey(key);
    });

    // eslint-disable-next-line no-console
    console.info('[DatasetLoader] Watching dataset folder for changes:', DATA_FOLDER_PATH);
    // Close the watcher on process exit
    process.on('exit', () => watcher.close());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[DatasetLoader] Failed to start file watcher:', err);
  }
}

// Event emitter used to notify other services when a dataset file changes
export const datasetEvents = new EventEmitter();

// Start watching immediately so cache invalidation happens in real-time
startFileWatcher();

export class DatasetLoader {
  static async loadFile<T extends DatasetKey>(key: T): Promise<DatasetBundle[T]> {
    const cacheEntry = datasetCache[key];
    const fileName = DATASET_FILE_NAMES[key];
    const filePath = path.join(DATA_FOLDER_PATH, fileName);

    const fileStats = await stat(filePath);
    const raw = await readFile(filePath, 'utf8');
    // Trim UTF-8 BOM if present (some Windows editors write a BOM). This prevents JSON.parse errors.
    const clean = raw.replace(/^\uFEFF/, '');
    const parsed = JSON.parse(clean);

    this.validateDataset(key, parsed);
    datasetCache[key] = {
      data: parsed,
      mtimeMs: fileStats.mtimeMs
    };

    return deepClone(parsed) as DatasetBundle[T];
  }

  static async loadAll(): Promise<DatasetBundle> {
    const entries = await Promise.all(
      Object.keys(DATASET_FILE_NAMES).map(async (key) => {
        const typedKey = key as DatasetKey;
        const dataset = await this.loadFile(typedKey);
        return [typedKey, dataset] as const;
      })
    );

    return Object.fromEntries(entries) as unknown as DatasetBundle;
  }

  static clearCache(): void {
    Object.keys(datasetCache).forEach((key) => {
      delete datasetCache[key as DatasetKey];
    });
  }

  private static validateDataset(key: DatasetKey, value: unknown): void {
    switch (key) {
      case 'iss':
        this.validateISSData(value);
        break;
      case 'spaceWeather':
        this.validateSpaceWeatherData(value);
        break;
      case 'astronauts':
        this.validateAstronautData(value);
        break;
      case 'rocket':
        this.validateRocketData(value);
        break;
      case 'nasa':
        this.validateNASAData(value);
        break;
      case 'mission':
        this.validateMissionData(value);
        break;
      default:
        throw new Error(`Unknown dataset key '${key}'`);
    }
  }

  private static validateISSData(value: unknown): void {
    assertObject(value, 'ISS dataset');
    assertString(value.name, 'iss.name');
    assertNumber(value.latitude, 'iss.latitude');
    assertNumber(value.longitude, 'iss.longitude');
    assertNumber(value.altitude, 'iss.altitude');
    assertNumber(value.velocity, 'iss.velocity');
    assertString(value.timestamp, 'iss.timestamp');
  }

  private static validateSpaceWeatherData(value: unknown): void {
    assertObject(value, 'Space weather dataset');
    assertString(value.status, 'spaceWeather.status');
    assertNumber(value.auroralPower, 'spaceWeather.auroralPower');
    assertNumber(value.plasmaDensity, 'spaceWeather.plasmaDensity');
    assertNumber(value.solarWindSpeed, 'spaceWeather.solarWindSpeed');
    assertNumber(value.magneticFieldIntensity, 'spaceWeather.magneticFieldIntensity');
    assertString(value.description, 'spaceWeather.description');
    assertNumber(value.kpIndex, 'spaceWeather.kpIndex');
    assertNumber(value.solarFlux, 'spaceWeather.solarFlux');
  }

  private static validateAstronautData(value: unknown): void {
    if (!Array.isArray(value)) {
      throw new TypeError('astronauts dataset must be an array');
    }

    for (const [index, astronaut] of value.entries()) {
      assertObject(astronaut, `astronauts[${index}]`);
      assertString(astronaut.id, `astronauts[${index}].id`);
      assertString(astronaut.name, `astronauts[${index}].name`);
      assertString(astronaut.role, `astronauts[${index}].role`);
      assertString(astronaut.missionSpecialty, `astronauts[${index}].missionSpecialty`);
      assertNumber(astronaut.healthScore, `astronauts[${index}].healthScore`);
      assertString(astronaut.status, `astronauts[${index}].status`);
      assertObject(astronaut.vitalSigns, `astronauts[${index}].vitalSigns`);
      assertNumber(astronaut.vitalSigns.heartRate, `astronauts[${index}].vitalSigns.heartRate`);
      assertNumber(astronaut.vitalSigns.oxygenSaturation, `astronauts[${index}].vitalSigns.oxygenSaturation`);
      assertNumber(astronaut.vitalSigns.cabinPressure, `astronauts[${index}].vitalSigns.cabinPressure`);
      assertNumber(astronaut.vitalSigns.temperature, `astronauts[${index}].vitalSigns.temperature`);
      assertString(astronaut.lastUpdate, `astronauts[${index}].lastUpdate`);
    }
  }

  private static validateRocketData(value: unknown): void {
    assertObject(value, 'rocket dataset');
    assertString(value.id, 'rocket.id');
    assertString(value.name, 'rocket.name');
    assertString(value.status, 'rocket.status');
    assertNumber(value.healthScore, 'rocket.healthScore');
    assertString(value.currentStage, 'rocket.currentStage');
    assertString(value.lastCheck, 'rocket.lastCheck');
    assertObject(value.systems, 'rocket.systems');
    assertNumber(value.systems.thrust, 'rocket.systems.thrust');
    assertNumber(value.systems.fuelPressure, 'rocket.systems.fuelPressure');
    assertNumber(value.systems.thermalManagement, 'rocket.systems.thermalManagement');
    assertNumber(value.systems.propulsionSystem, 'rocket.systems.propulsionSystem');
    assertNumber(value.systems.avionicsHealth, 'rocket.systems.avionicsHealth');
  }

  private static validateNASAData(value: unknown): void {
    assertObject(value, 'nasa dataset');
    assertObject(value.apod, 'nasa.apod');
    assertString(value.apod.title, 'nasa.apod.title');
    assertString(value.apod.explanation, 'nasa.apod.explanation');
    assertString(value.apod.url, 'nasa.apod.url');
    assertString(value.apod.hdurl, 'nasa.apod.hdurl');
    assertString(value.apod.date, 'nasa.apod.date');
    assertObject(value.asteroids, 'nasa.asteroids');
    assertNumber(value.asteroids.hazardousCount, 'nasa.asteroids.hazardousCount');
    assertString(value.asteroids.closestAsteroid, 'nasa.asteroids.closestAsteroid');
    assertNumber(value.asteroids.closestDistance, 'nasa.asteroids.closestDistance');
    assertNumber(value.asteroids.trackedToday, 'nasa.asteroids.trackedToday');
    assertString(value.asteroids.summary, 'nasa.asteroids.summary');
    assertObject(value.solarActivity, 'nasa.solarActivity');
    assertString(value.solarActivity.flareIndex, 'nasa.solarActivity.flareIndex');
    assertString(value.solarActivity.geomagneticStormLevel, 'nasa.solarActivity.geomagneticStormLevel');
  }

  private static validateMissionData(value: unknown): void {
    assertObject(value, 'mission dataset');
    assertString(value.missionId, 'mission.missionId');
    assertString(value.missionName, 'mission.missionName');
    assertString(value.phase, 'mission.phase');
    assertString(value.duration, 'mission.duration');
    assertString(value.startDate, 'mission.startDate');
    if (!Array.isArray(value.objectives) || value.objectives.some((item) => typeof item !== 'string')) {
      throw new TypeError('mission.objectives must be a string array');
    }
    if (!Array.isArray(value.crewManifest) || value.crewManifest.some((item) => typeof item !== 'string')) {
      throw new TypeError('mission.crewManifest must be a string array');
    }
  }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

