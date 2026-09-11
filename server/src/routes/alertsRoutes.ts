// codeauthor chetas karnam
import { Router } from 'express';
import { buildAlertSnapshot } from '../services/dashboardService.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/alerts', async (_req, res, next) => {
  try {
    const alertSnapshot = await buildAlertSnapshot();
    sendSuccess(res, alertSnapshot, 'Alerts loaded');
  } catch (error) {
    next(error);
  }
});

export default router;
