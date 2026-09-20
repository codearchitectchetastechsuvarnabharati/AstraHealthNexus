import { Router } from 'express';
import type { PythonMonitor } from '../services/pythonMonitor.js';

export function createServiceHealthRouter(monitor: PythonMonitor) {
  const router = Router();
  router.get('/health/python', async (_req, res, next) => {
    try {
      const health = await monitor.current();
      res.setHeader('Cache-Control', 'no-store');
      if (health.status !== 'available') res.setHeader('Retry-After', '15');
      res.status(health.status === 'available' ? 200 : 503).json({ status: health.status === 'available' ? 'ok' : 'degraded', dependency: health });
    } catch (error) { next(error); }
  });
  return router;
}
