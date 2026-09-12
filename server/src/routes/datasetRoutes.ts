import { Router } from 'express';
import { DatasetService } from '../services/datasetService.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();
const validDatasetKeys = new Set(['iss', 'weather', 'spaceWeather', 'astronauts', 'rocket', 'nasa', 'mission']);

router.get('/dataset', async (_req, res, next) => {
  try {
    const data = await DatasetService.getAllData();
    sendSuccess(res, data, 'Complete mission dataset loaded from the local dataset provider');
  } catch (error) {
    next(error);
  }
});

router.get('/dataset/keys', (_req, res) => {
  sendSuccess(res, Array.from(validDatasetKeys), 'Dataset keys loaded');
});

router.post('/dataset/refresh', (_req, res, next) => {
  try {
    DatasetService.reloadData();
    sendSuccess(res, null, 'Local dataset cache cleared and refreshed');
  } catch (error) {
    next(error);
  }
});

// Search endpoint - must come BEFORE /dataset/:datasetKey so it's not matched as a dataset key
router.get('/dataset/search', async (req, res, next) => {
  try {
    const { q, dataset, field } = req.query;

    // Validate required query parameter
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return sendError(res, 400, 'Search query "q" is required and must be a non-empty string', 'INVALID_SEARCH_QUERY');
    }

    const keyword = q.trim().toLowerCase();

    // Determine which datasets to search
    let datasetsToSearch: string[] = [];
    if (dataset && typeof dataset === 'string') {
      if (!validDatasetKeys.has(dataset)) {
        return sendError(res, 400, `Dataset '${dataset}' is not available`, 'INVALID_DATASET');
      }
      datasetsToSearch = [dataset];
    } else {
      datasetsToSearch = Array.from(validDatasetKeys);
    }

    const results: Array<{ dataset: string; matches: unknown[] }> = [];

    for (const key of datasetsToSearch) {
      const data = key === 'weather'
        ? await DatasetService.getSpaceWeatherData()
        : await DatasetService.getDatasetByKey(key as any);

      const matches = searchInData(data, keyword, field as string | undefined);
      if (matches.length > 0) {
        results.push({ dataset: key, matches });
      }
    }

    sendSuccess(res, {
      query: q,
      datasetFilter: dataset ?? null,
      fieldFilter: field ?? null,
      totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0),
      results
    }, `Search completed for "${q}"`);
  } catch (error) {
    next(error);
  }
});

// Recursive search function
function searchInData(data: unknown, keyword: string, field?: string): unknown[] {
  const matches: unknown[] = [];

  function walk(node: unknown, path: string) {
    if (node === null || node === undefined) return;

    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;

      // If a specific field is requested, only check that field
      if (field) {
        if (Object.prototype.hasOwnProperty.call(obj, field)) {
          const value = obj[field];
          if (String(value).toLowerCase().includes(keyword)) {
            matches.push({ path, ...obj });
            return;
          }
        }
      } else {
        // Check all fields
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string' || typeof value === 'number') {
            if (String(value).toLowerCase().includes(keyword)) {
              matches.push({ path, ...obj });
              return;
            }
          }
        }
      }

      // Recurse into nested objects/arrays
      for (const value of Object.values(obj)) {
        if (value !== null && typeof value === 'object') {
          walk(value, path);
        }
      }
      return;
    }

    if (String(node).toLowerCase().includes(keyword)) {
      matches.push({ path, value: node });
    }
  }

  walk(data, 'root');
  return matches;
}

router.get('/dataset/:datasetKey', async (req, res, next) => {
  try {
    const key = req.params.datasetKey as string;

    if (!validDatasetKeys.has(key)) {
      return sendError(res, 404, `Dataset '${key}' is not available`, 'DATASET_NOT_FOUND');
    }

    const payload = key === 'weather'
      ? await DatasetService.getSpaceWeatherData()
      : await DatasetService.getDatasetByKey(key as any);

    sendSuccess(res, payload, `Dataset '${key}' loaded`);
  } catch (error) {
    next(error);
  }
});

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

export default router;