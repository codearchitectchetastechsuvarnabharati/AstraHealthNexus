// codeauthor chetas karnam
import { Router } from 'express';
import { DatasetService } from '../services/datasetService.js';

const router = Router();
const validDatasetKeys = new Set(['iss', 'weather', 'spaceWeather', 'astronauts', 'rocket', 'nasa', 'mission']);

router.get('/dataset', async (_req, res) => {
  try {
    const data = await DatasetService.getAllData();
    res.json({
      status: 'success',
      message: 'Complete mission dataset loaded from the local dataset provider',
      data
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load dataset', error: String(error) });
  }
});

router.get('/dataset/keys', (_req, res) => {
  res.json({ status: 'success', keys: Array.from(validDatasetKeys) });
});

router.post('/dataset/refresh', (_req, res) => {
  try {
    DatasetService.reloadData();
    res.json({ status: 'success', message: 'Local dataset cache cleared and refreshed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to refresh dataset cache', error: String(error) });
  }
});

router.get('/dataset/:datasetKey', async (req, res) => {
  try {
    const key = req.params.datasetKey as string;
    if (!validDatasetKeys.has(key)) {
      return res.status(404).json({ status: 'error', message: `Dataset '${key}' is not available` });
    }

    const payload = key === 'weather'
      ? await DatasetService.getSpaceWeatherData()
      : await DatasetService.getDatasetByKey(key as any);

    res.json({ status: 'success', data: payload });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load dataset', error: String(error) });
  }
});

router.get('/dataset/astronauts/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const astronauts = await DatasetService.getAstronautData();
    const astronaut = astronauts.find((crew) => crew.id === id);

    if (!astronaut) {
      return res.status(404).json({ status: 'error', message: `Astronaut '${id}' not found in local dataset` });
    }

    res.json({ status: 'success', data: astronaut });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load astronaut data', error: String(error) });
  }
});

export default router;
