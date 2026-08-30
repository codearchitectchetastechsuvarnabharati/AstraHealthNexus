import { Router } from 'express';
import { buildAlertSnapshot } from '../services/dashboardService.js';

const router = Router();

router.get('/alerts', async (_req, res, next) => {
  try {
    const alertSnapshot = await buildAlertSnapshot();
    res.json(alertSnapshot);
  } catch (error) {
    next(error);
  }
});

export default router;
