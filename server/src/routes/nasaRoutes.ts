import { Router } from 'express';
import { buildDashboardSnapshot, getCachedDashboardSnapshot, snapshotEvents } from '../services/dashboardService.js';

const router = Router();

router.get('/nasa/stream', async (_req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  // Send the current cached snapshot or generate one if missing
  try {
    let snapshot = getCachedDashboardSnapshot();
    if (!snapshot) {
      snapshot = await buildDashboardSnapshot(true);
    }
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`);
  }

  const onUpdate = (snapshot: any) => {
    try {
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    } catch (err) {
      // ignore write errors; connection may be closed
    }
  };

  snapshotEvents.on('snapshotUpdated', onUpdate);

  res.on('close', () => {
    snapshotEvents.off('snapshotUpdated', onUpdate);
    try { res.end(); } catch (e) { }
  });
});

export default router;
