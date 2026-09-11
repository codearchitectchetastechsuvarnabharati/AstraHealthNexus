import { Router } from 'express';
import { collectTelemetrySnapshot, getTelemetryHistory } from '../services/ingestionService.js';
import { sendSuccess } from '../utils/apiResponse.js';
const router = Router();

router.get('/telemetry', async (_req, res, next) => {
  try {
    const snapshot = await collectTelemetrySnapshot();
    sendSuccess(res, { snapshot, history: getTelemetryHistory() }, 'Telemetry snapshot loaded');
  } catch (error) {
    next(error);
  }
});

router.get('/telemetry/live', async (_req, res, next) => {
  try {
    const snapshot = await collectTelemetrySnapshot();
  sendSuccess(res, snapshot, 'Live telemetry snapshot loaded');
  } catch (error) {
    next(error);
  }
});

export default router;
