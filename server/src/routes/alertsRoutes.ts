// codeauthor chetas karnam
/* import { Router } from 'express';
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

export default router; */

// codeauthor chetas karnam
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { buildAlertSnapshot } from '../services/dashboardService.js';
import { getAlertHistory } from '../services/alertHistoryService.js';

const router = Router();
const prisma = new PrismaClient();

function parseLimit(value: unknown): number | null {
  if (value === undefined) return 50;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : null;
}

function parseOffset(value: unknown): number | null {
  if (value === undefined) return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseDate(value: unknown): Date | undefined | null {
  if (value === undefined) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

router.get('/alerts', async (_req, res) => {
  try {
    const alertSnapshot = await buildAlertSnapshot();
    res.json(alertSnapshot);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load alerts', error: String(error) });
  }
});

router.get('/alerts/history', async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);

    if (limit === null) {
      res.status(400).json({ message: 'limit must be an integer from 1 to 100' });
      return;
    }

    if (offset === null) {
      res.status(400).json({ message: 'offset must be a non-negative integer' });
      return;
    }

    if (from === null || to === null) {
      res.status(400).json({ message: 'from and to must be valid date/time values' });
      return;
    }

    if (from && to && from > to) {
      res.status(400).json({ message: 'from must be earlier than or equal to to' });
      return;
    }

    const severity =
      typeof req.query.severity === 'string'
        ? req.query.severity.trim().toLowerCase()
        : undefined;

    const source =
      typeof req.query.source === 'string'
        ? req.query.source.trim()
        : undefined;

    const search =
      typeof req.query.search === 'string'
        ? req.query.search.trim()
        : undefined;

    const history = await getAlertHistory({
      severity: severity || undefined,
      source: source || undefined,
      search: search || undefined,
      from,
      to,
      limit,
      offset
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to load alert history',
      error: String(error)
    });
  }
});

// SCRUMBOARD-25: Acknowledge an alert
router.patch('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;

    const updatedAlert = await prisma.alertEvent.update({
      where: { id },
      data: { isAcknowledged: true }
    });

    res.json({
      message: 'Alert acknowledged successfully',
      alert: updatedAlert
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to acknowledge alert. The ID might not exist.',
      error: String(error)
    });
  }
});

export default router;
