// codeauthor chetas karnam
import { Router } from 'express';
import { collectTelemetrySnapshot, getTelemetryHistory } from '../services/ingestionService.js';

const router = Router();

router.get('/telemetry', async (_req, res) => {
  try {
    const snapshot = await collectTelemetrySnapshot();
    res.json({ snapshot, history: getTelemetryHistory() });
  } catch (error) {
    res.status(500).json({ message: 'Failed to collect telemetry', error: String(error) });
  }
});

router.get('/telemetry/live', async (_req, res) => {
  try {
    const snapshot = await collectTelemetrySnapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ message: 'Failed to collect live telemetry', error: String(error) });
  }
});

export default router;
