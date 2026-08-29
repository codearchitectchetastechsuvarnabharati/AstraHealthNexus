// codeauthor chetas karnam
import { Router } from 'express';
import { buildDashboardSnapshot } from '../services/dashboardService.js';

const router = Router();

router.get('/dashboard', async (_req, res) => {
  try {
    const snapshot = await buildDashboardSnapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load dashboard snapshot', error: String(error) });
  }
});

export default router;
