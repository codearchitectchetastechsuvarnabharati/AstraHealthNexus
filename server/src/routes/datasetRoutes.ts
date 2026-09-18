import { Router } from 'express';
import { DatasetService } from '../services/datasetService.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();
const validDatasetKeys = new Set(['iss', 'weather', 'spaceWeather', 'astronauts', 'rocket', 'nasa', 'mission']);

// Dataset keys endpoint
router.get('/dataset/keys', (_req, res) => {
  sendSuccess(res, Array.from(validDatasetKeys), 'Dataset keys loaded');
});

// Refresh endpoint
router.post('/dataset/refresh', async (_req, res, next) => {
  try {
    await DatasetService.reloadData();
    sendSuccess(res, null, 'Local datasets reloaded successfully');
  } catch (error) {
    next(error);
  }
});

// Full dataset endpoint with optional filtering
router.get('/dataset', async (req, res, next) => {
  try {
    const data = await DatasetService.getAllData();
    const filtered = applyFilters(data, req.query);
    sendSuccess(res, filtered, 'Complete mission dataset loaded from the local dataset provider');
  } catch (error) {
    next(error);
  }
});

// Astronaut by id (specific endpoint BEFORE the generic :datasetKey route)
router.get('/dataset/astronauts/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const astronauts = await DatasetService.getAstronautData();
    const astronaut = astronauts.find((crew) => crew.id === id);

    if (!astronaut) {
      return sendError(res, 404, `Astronaut '${id}' not found in local dataset`, 'ASTRONAUT_NOT_FOUND');
    }

    sendSuccess(res, astronaut, `Astronaut '${id}' loaded`);
  } catch (error) {
    next(error);
  }
});

// Generic dataset endpoint with filtering
router.get('/dataset/:datasetKey', async (req, res, next) => {
  try {
    const key = req.params.datasetKey as string;

    if (!validDatasetKeys.has(key)) {
      return sendError(res, 404, `Dataset '${key}' is not available`, 'DATASET_NOT_FOUND');
    }

    const payload = key === 'weather'
      ? await DatasetService.getSpaceWeatherData()
      : await DatasetService.getDatasetByKey(key as any);

    const filtered = applyFilters(payload, req.query);
    sendSuccess(res, filtered, `Dataset '${key}' loaded`);
  } catch (error) {
    next(error);
  }
});

/**
 * Apply query filters to any data shape.
 * Supports:
 *   - field=value        → exact (case-insensitive) match on a field
 *   - field__contains=x  → substring match on a field
 *   - field__gte=n       → numeric >= comparison
 *   - field__lte=n       → numeric <= comparison
 *   - field__ne=value    → not-equal match
 * Filters arrays by keeping only items that match ALL filters.
 * If the data is an object (not array), only that single object is checked.
 */
function applyFilters(data: unknown, query: Record<string, unknown>): unknown {
  // Collect filter params (ignore pagination-ish keys)
  const ignoredKeys = new Set(['page', 'pageSize', 'limit', 'offset']);
  const filters: Array<{ field: string; op: string; value: string }> = [];

  for (const [rawKey, rawValue] of Object.entries(query)) {
    if (ignoredKeys.has(rawKey)) continue;
    if (rawValue === undefined || rawValue === null) continue;

    const value = String(rawValue);
    // Detect operator suffix: field__op
    const match = rawKey.match(/^([A-Za-z0-9_.]+)__(contains|gte|lte|ne)$/);
    if (match) {
      filters.push({ field: match[1], op: match[2], value });
    } else {
      filters.push({ field: rawKey, op: 'eq', value });
    }
  }

  if (filters.length === 0) return data;

  function itemMatches(item: unknown): boolean {
    if (item === null || typeof item !== 'object') return false;
    const obj = item as Record<string, unknown>;

    for (const { field, op, value } of filters) {
      // Support dot notation: vitalSigns.oxygenSaturation
      const parts = field.split('.');
      let current: unknown = obj;
      for (const part of parts) {
        if (current === null || typeof current !== 'object') {
          current = undefined;
          break;
        }
        current = (current as Record<string, unknown>)[part];
      }

      if (current === undefined) return false;

      const actual = current;
      const needle = value.toLowerCase();

      switch (op) {
        case 'eq': {
          if (typeof actual === 'number' || typeof actual === 'boolean') {
            if (String(actual).toLowerCase() !== needle) return false;
          } else {
            if (String(actual).toLowerCase() !== needle) return false;
          }
          break;
        }
        case 'ne': {
          if (String(actual).toLowerCase() === needle) return false;
          break;
        }
        case 'contains': {
          if (!String(actual).toLowerCase().includes(needle)) return false;
          break;
        }
        case 'gte': {
          const a = Number(actual);
          const n = Number(value);
          if (isNaN(a) || isNaN(n) || a < n) return false;
          break;
        }
        case 'lte': {
          const a = Number(actual);
          const n = Number(value);
          if (isNaN(a) || isNaN(n) || a > n) return false;
          break;
        }
      }
    }
    return true;
  }

  if (Array.isArray(data)) {
    return data.filter(itemMatches);
  }

  // For object-shaped data (like iss, weather, mission), return it only if it matches
  return itemMatches(data) ? data : null;
}

export default router;