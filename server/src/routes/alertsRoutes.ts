// codeauthor chetas karnam
/* import { Router } from 'express';
import { buildAlertSnapshot } from '../services/dashboardService.js';

const router = Router();

function normalizeSeverity(sev: string) {
  const s = String(sev ?? '').toLowerCase();
  if (s === 'critical' || s === 'high') return 'Critical';
  if (s === 'warning' || s === 'warn' || s === 'medium') return 'Warning';
  return 'Info';
}

router.get('/alerts', async (_req, res) => {
  try {
    const alertSnapshot = await buildAlertSnapshot();

    // Build the API response from the normalized dashboard events.
    const events = Array.isArray(alertSnapshot.events) ? alertSnapshot.events : [];
    const alertsFromEvents = events.map((ev: any, idx: number) => {
      const severity = normalizeSeverity(ev.severity ?? ev.level ?? 'info');
      const ts = ev.timestamp ? new Date(ev.timestamp).toISOString() : new Date().toISOString();
      const id = `alert-${new Date(ts).getTime()}-${idx}`;
      const title = String(ev.title ?? ev.message ?? '').split('.').shift() || `Alert ${idx + 1}`;
      const description = String(ev.message ?? ev.description ?? ev.title ?? '');
      const source = ev.source ?? ev.sourceSystem ?? 'System';
      const affectedSubsystem = ev.affectedSubsystem ?? ev.subsystem ?? source ?? 'Mission';
      const status = (severity === 'Info') ? 'Resolved' : (ev.status ?? 'Active');

      return {
        id,
        title,
        description,
        severity,
        timestamp: ts,
        source,
        affectedSubsystem,
        status
      };
    });

    res.json({ status: 'success', summary: alertSnapshot.summary ?? 'alerts', data: alertsFromEvents });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load alerts', error: String(error) });
  }
});

export default router; */

// codeauthor chetas karnam
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { buildAlertSnapshot } from '../services/dashboardService.js';

const router = Router();
// Initialize Prisma to talk to the database
const prisma = new PrismaClient();

router.get('/alerts', async (_req, res) => {
  try {
    const alertSnapshot = await buildAlertSnapshot();
    res.json(alertSnapshot);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load alerts', error: String(error) });
  }
});

// SCRUMBOARD-25: Acknowledge an alert
router.patch('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update only the isAcknowledged field for the specific ID
    const updatedAlert = await prisma.alertEvent.update({
      where: { id: id },
      data: { isAcknowledged: true },
    });
    
    res.json({ message: 'Alert acknowledged successfully', alert: updatedAlert });
  } catch (error) {
    res.status(500).json({ message: 'Failed to acknowledge alert. The ID might not exist.', error: String(error) });
  }
});

export default router;
