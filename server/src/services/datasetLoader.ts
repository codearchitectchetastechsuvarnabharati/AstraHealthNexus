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

export class DatasetValidationError extends Error {
  public readonly dataset: string;
  public readonly path: string;
  public readonly reason: string;

  constructor(dataset: string, fieldPath: string, reason: string) {
    super(`[${dataset}] ${fieldPath}: ${reason}`);
    this.name = 'DatasetValidationError';
    this.dataset = dataset;
    this.path = fieldPath;
    this.reason = reason;
  }
}

// --- Assert helpers ---
function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string`);
  }
  if (value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function assertStringAllowEmpty(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string`);
  }
}

function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`${name} must be a valid number`);
  }
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function assertRange(value: unknown, name: string, min: number, max: number): void {
  assertNumber(value, name);
  if (value < min || value > max) {
    throw new TypeError(`${name} must be between ${min} and ${max} (got ${value})`);
  }
}

function assertEnum<T extends string>(value: unknown, name: string, allowed: readonly T[]): asserts value is T {
  assertString(value, name);
  if (!allowed.includes(value as T)) {
    throw new TypeError(`${name} must be one of: ${allowed.join(', ')} (got "${value}")`);
  }
}

function assertIsoDate(value: unknown, name: string): void {
  assertString(value, name);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new TypeError(`${name} must be a valid ISO date string (got "${value}")`);
  }
}

function assertArray(value: unknown, name: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }
}

function assertStringArray(value: unknown, name: string): asserts value is string[] {
  assertArray(value, name);
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new TypeError(`${name}[${index}] must be a non-empty string`);
    }
  });
}

// --- Cache + watcher ---
const datasetCache: Partial<Record<DatasetKey, DatasetCacheEntry>> = {};
const fileChangeTimers: Map<string, NodeJS.Timeout> = new Map();

export const datasetEvents = new EventEmitter();

function keyFromFilename(filename: string): DatasetKey | null {
  for (const k of Object.keys(DATASET_FILE_NAMES)) {
    if (DATASET_FILE_NAMES[k as DatasetKey] === filename) return k as DatasetKey;
  }
  return null;
}

function scheduleClearForKey(key: DatasetKey) {
  const timerKey = key;
  if (fileChangeTimers.has(timerKey)) {
    clearTimeout(fileChangeTimers.get(timerKey)!);
  }
  const t = setTimeout(() => {
    if (datasetCache[key]) {
      delete datasetCache[key];
      console.info(`[DatasetLoader] Cleared cache for key '${key}' due to file change`);
    }
    try {
      datasetEvents.emit('datasetChanged', key);
    } catch (err) {
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
      if (!filename.toLowerCase().endsWith('.json')) return;
      const key = keyFromFilename(filename);
      if (!key) return;
      scheduleClearForKey(key);
    });

    console.info('[DatasetLoader] Watching dataset folder for changes:', DATA_FOLDER_PATH);
    process.on('exit', () => watcher.close());
  } catch (err) {
    console.error('[DatasetLoader] Failed to start file watcher:', err);
  }
}

startFileWatcher();

// --- Loader ---
export class DatasetLoader {
  static async loadFile<T extends DatasetKey>(key: T): Promise<DatasetBundle[T]> {
    const fileName = DATASET_FILE_NAMES[key];
    const filePath = path.join(DATA_FOLDER_PATH, fileName);

    const fileStats = await stat(filePath);
    const raw = await readFile(filePath, 'utf8');
    const clean = raw.replace(/^\uFEFF/, '');

    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch (err) {
      throw new DatasetValidationError(key, 'root', `Invalid JSON: ${(err as Error).message}`);
    }

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
    try {
      switch (key) {
        case 'iss': this.validateISSData(value); break;
        case 'spaceWeather': this.validateSpaceWeatherData(value); break;
        case 'astronauts': this.validateAstronautData(value); break;
        case 'rocket': this.validateRocketData(value); break;
        case 'nasa': this.validateNASAData(value); break;
        case 'mission': this.validateMissionData(value); break;
        default: throw new Error(`Unknown dataset key '${key}'`);
      }
    } catch (err) {
      if (err instanceof TypeError) {
        throw new DatasetValidationError(key, 'unknown', err.message);
      }
      throw err;
    }
  }

  private static validateISSData(value: unknown): void {
    assertObject(value, 'ISS dataset');
    assertString(value.name, 'iss.name');
    assertRange(value.latitude, 'iss.latitude', -90, 90);
    assertRange(value.longitude, 'iss.longitude', -180, 180);
    assertRange(value.altitude, 'iss.altitude', 0, 2000);
    assertRange(value.velocity, 'iss.velocity', 0, 50000);
    assertIsoDate(value.timestamp, 'iss.timestamp');

    if ('orbitPeriodMinutes' in value) {
      assertRange(value.orbitPeriodMinutes, 'iss.orbitPeriodMinutes', 0, 500);
    }
    if ('powerGeneration' in value) {
      assertRange(value.powerGeneration, 'iss.powerGeneration', 0, 1000000);
    }
    if ('nextPassOver' in value) {
      assertIsoDate(value.nextPassOver, 'iss.nextPassOver');
    }
  }

  private static validateSpaceWeatherData(value: unknown): void {
    assertObject(value, 'Space weather dataset');
    assertString(value.status, 'spaceWeather.status');
    assertRange(value.auroralPower, 'spaceWeather.auroralPower', 0, 10000);
    assertRange(value.plasmaDensity, 'spaceWeather.plasmaDensity', 0, 1000);
    assertRange(value.solarWindSpeed, 'spaceWeather.solarWindSpeed', 0, 5000);
    assertRange(value.magneticFieldIntensity, 'spaceWeather.magneticFieldIntensity', 0, 1000);
    assertString(value.description, 'spaceWeather.description');
    assertRange(value.kpIndex, 'spaceWeather.kpIndex', 0, 9);
    assertRange(value.solarFlux, 'spaceWeather.solarFlux', 0, 10000);
  }

  private static validateAstronautData(value: unknown): void {
    assertArray(value, 'astronauts dataset');

    if (value.length === 0) {
      throw new TypeError('astronauts dataset must contain at least one record');
    }

    const seenIds = new Set<string>();

    for (const [index, astronaut] of value.entries()) {
      const prefix = `astronauts[${index}]`;
      assertObject(astronaut, prefix);
      assertString(astronaut.id, `${prefix}.id`);
      assertString(astronaut.name, `${prefix}.name`);
      assertString(astronaut.role, `${prefix}.role`);
      assertString(astronaut.missionSpecialty, `${prefix}.missionSpecialty`);
      assertRange(astronaut.healthScore, `${prefix}.healthScore`, 0, 100);
      assertEnum(astronaut.status, `${prefix}.status`, ['Stable', 'Monitor', 'Attention'] as const);

      if (seenIds.has(astronaut.id as string)) {
        throw new TypeError(`${prefix}.id "${astronaut.id}" is duplicated`);
      }
      seenIds.add(astronaut.id as string);

      assertObject(astronaut.vitalSigns, `${prefix}.vitalSigns`);
      assertRange(astronaut.vitalSigns.heartRate, `${prefix}.vitalSigns.heartRate`, 30, 220);
      assertRange(astronaut.vitalSigns.oxygenSaturation, `${prefix}.vitalSigns.oxygenSaturation`, 0, 100);
      assertRange(astronaut.vitalSigns.cabinPressure, `${prefix}.vitalSigns.cabinPressure`, 0, 200);
      assertRange(astronaut.vitalSigns.temperature, `${prefix}.vitalSigns.temperature`, 30, 45);

      assertIsoDate(astronaut.lastUpdate, `${prefix}.lastUpdate`);
    }
  }

  private static validateRocketData(value: unknown): void {
    assertObject(value, 'rocket dataset');
    assertString(value.id, 'rocket.id');
    assertString(value.name, 'rocket.name');
    assertString(value.status, 'rocket.status');
    assertRange(value.healthScore, 'rocket.healthScore', 0, 100);
    assertString(value.currentStage, 'rocket.currentStage');
    assertIsoDate(value.lastCheck, 'rocket.lastCheck');

    assertObject(value.systems, 'rocket.systems');
    assertRange(value.systems.thrust, 'rocket.systems.thrust', 0, 100);
    assertRange(value.systems.fuelPressure, 'rocket.systems.fuelPressure', 0, 100);
    assertRange(value.systems.thermalManagement, 'rocket.systems.thermalManagement', 0, 100);
    assertRange(value.systems.propulsionSystem, 'rocket.systems.propulsionSystem', 0, 100);
    assertRange(value.systems.avionicsHealth, 'rocket.systems.avionicsHealth', 0, 100);
  }

  private static validateNASAData(value: unknown): void {
    assertObject(value, 'nasa dataset');

    assertObject(value.apod, 'nasa.apod');
    assertString(value.apod.title, 'nasa.apod.title');
    assertString(value.apod.explanation, 'nasa.apod.explanation');
    assertStringAllowEmpty(value.apod.url ?? '', 'nasa.apod.url');
    assertStringAllowEmpty(value.apod.hdurl ?? '', 'nasa.apod.hdurl');
    assertIsoDate(value.apod.date, 'nasa.apod.date');

    assertObject(value.asteroids, 'nasa.asteroids');
    assertRange(value.asteroids.hazardousCount, 'nasa.asteroids.hazardousCount', 0, 100000);
    assertString(value.asteroids.closestAsteroid, 'nasa.asteroids.closestAsteroid');
    assertRange(value.asteroids.closestDistance, 'nasa.asteroids.closestDistance', 0, 1000000);
    assertRange(value.asteroids.trackedToday, 'nasa.asteroids.trackedToday', 0, 100000);
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
    assertIsoDate(value.startDate, 'mission.startDate');

    assertStringArray(value.objectives, 'mission.objectives');
    assertStringArray(value.crewManifest, 'mission.crewManifest');

    if ((value.objectives as string[]).length === 0) {
      throw new TypeError('mission.objectives must not be empty');
    }
    if ((value.crewManifest as string[]).length === 0) {
      throw new TypeError('mission.crewManifest must not be empty');
    }
  }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}