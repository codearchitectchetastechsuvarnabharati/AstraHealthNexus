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
