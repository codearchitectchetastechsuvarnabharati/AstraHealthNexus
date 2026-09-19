import { nasaService, NasaService, NasaError, NasaQuerySchema } from '../services/nasaService.js';
import { validate } from '../middleware/validation.js';
import { PaginationQuerySchema, type PaginationQuery } from '../schemas.js';
import { pageCollections } from '../middleware/pagination.js';
import { getRequestId } from '../middleware/requestLogger.js';
// codeauthor chetas karnam
import { Router } from 'express';
import { buildDashboardSnapshot, getCachedDashboardSnapshot, snapshotEvents } from '../services/dashboardService.js';
import { logError, logEvent } from '../middleware/logger.js';

export function createNasaDataRouter(service: NasaService = nasaService) {
  const dataRouter = Router();
  for (const endpoint of ['apod', 'asteroids'] as const) {
    dataRouter.get(`/nasa/${endpoint}`, validate({ query: NasaQuerySchema }), async (req, res, next) => {
      try {
        const result = await service.get(endpoint, req.query.date as string | undefined);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ status: 'success', ...result });
      } catch (error) {
        if (error instanceof NasaError && error.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds));
        next(error);
      }
    });
  }
  return dataRouter;
}

const router = Router();
router.use(createNasaDataRouter());

router.get('/nasa/stream', validate({ query: PaginationQuerySchema }), async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  logEvent('sse_connection_opened', {
    requestId: getRequestId(req),
    stream: 'nasa',
    method: req.method,
    path: req.originalUrl
  });

  const serialize = (snapshot: unknown) => {
    const page = pageCollections(snapshot, req.query as unknown as PaginationQuery);
    return JSON.stringify({ ...(page.data as object), collections: page.collections });
  };

  try {
    let snapshot = getCachedDashboardSnapshot();
    if (!snapshot) {
      snapshot = await buildDashboardSnapshot(true);
    }
    res.write(`data: ${serialize(snapshot)}\n\n`);
  } catch (err) {
    logError('SSE initial snapshot failed', {
      requestId: getRequestId(req),
      method: req.method,
      path: req.originalUrl,
      context: 'GET /nasa/stream',
      err
    });
    res.write(`event: error\ndata: ${JSON.stringify({ message: 'Snapshot unavailable' })}\n\n`);
  }

  const onUpdate = (snapshot: any) => {
    try {
      res.write(`data: ${serialize(snapshot)}\n\n`);
    } catch (err) {
      logError('sse_write_failed', { requestId: getRequestId(req), err });
    }
  };

  if (res.destroyed) return;
  snapshotEvents.on('snapshotUpdated', onUpdate);

  res.on('close', () => {
    snapshotEvents.off('snapshotUpdated', onUpdate);
    logEvent('sse_connection_closed', {
      requestId: getRequestId(req),
      stream: 'nasa'
    });
    try { res.end(); } catch (e) { /* ignore */ }
  });
});

export default router;
