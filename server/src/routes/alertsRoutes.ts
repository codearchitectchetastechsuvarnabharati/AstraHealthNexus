// codeauthor chetas karnam
import { Router } from 'express';
import { buildAlertSnapshot } from '../services/dashboardService.js';

const router = Router();

router.get('/alerts', async (_req, res) => {
  try {
    const alertSnapshot = await buildAlertSnapshot();
    res.json(alertSnapshot);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load alerts', error: String(error) });
  }
});

export default router;
