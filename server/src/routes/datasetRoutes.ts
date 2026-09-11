// codeauthor chetas karnam
import { Router } from 'express';
import { DatasetService } from '../services/datasetService.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();
const validDatasetKeys = new Set(['iss', 'weather', 'spaceWeather', 'astronauts', 'rocket', 'nasa', 'mission']);

router.get('/dataset', async (_req, res, next) => {
  try {
    const data = await DatasetService.getAllData();
    sendSuccess(
      res,
      data,
      'Complete mission dataset loaded from the local dataset provider'
    );
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

router.get('/dataset/:datasetKey', async (req, res, next) => {
  try {
    const key = req.params.datasetKey as string;

    if (!validDatasetKeys.has(key)) {
      return sendError(
        res,
        404,
        `Dataset '${key}' is not available`,
        'DATASET_NOT_FOUND'
      );
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
      return sendError(
        res,
        404,
        `Astronaut '${id}' not found in local dataset`,
        'ASTRONAUT_NOT_FOUND'
      );
    }

    sendSuccess(res, astronaut, `Astronaut '${id}' loaded`);
  } catch (error) {
    next(error);
  }
});

export default router;
