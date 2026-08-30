import { Router } from 'express';
import { collectTelemetrySnapshot, getTelemetryHistory } from '../services/ingestionService.js';

const router = Router();

router.get('/telemetry', async (_req, res, next) => {
  try {
    const snapshot = await collectTelemetrySnapshot();
    res.json({ snapshot, history: getTelemetryHistory() });
  } catch (error) {
    next(error);
  }
});

router.get('/telemetry/live', async (_req, res, next) => {
  try {
    const snapshot = await collectTelemetrySnapshot();
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

export default router;
