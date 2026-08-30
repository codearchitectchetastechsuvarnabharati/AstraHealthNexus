import { Router } from 'express';
import { buildDashboardSnapshot } from '../services/dashboardService.js';

const router = Router();

router.get('/dashboard', async (_req, res, next) => {
  try {
    const snapshot = await buildDashboardSnapshot();
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

export default router;
