// codeauthor chetas karnam
import { Router } from 'express';
import { buildDashboardSnapshot } from '../services/dashboardService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const router = Router();

router.get('/dashboard', async (req, res, next) => {
  try {
    const { category, status, mission, dateFrom, dateTo } = req.query;

    // Validate date formats if provided
    if (dateFrom && typeof dateFrom === 'string' && isNaN(Date.parse(dateFrom))) {
      return sendError(res, 400, 'Invalid dateFrom format. Use ISO 8601 (e.g. 2024-01-01)', 'INVALID_DATE');
    }
    if (dateTo && typeof dateTo === 'string' && isNaN(Date.parse(dateTo))) {
      return sendError(res, 400, 'Invalid dateTo format. Use ISO 8601 (e.g. 2024-12-31)', 'INVALID_DATE');
    }

    const snapshot = await buildDashboardSnapshot();

    // Apply filters
    let filtered = { ...snapshot };

    // Filter telemetry by category
    if (category && typeof category === 'string') {
      filtered.telemetry = filtered.telemetry.filter((t) =>
        t.label.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Filter alerts by status keyword
    if (status && typeof status === 'string') {
      filtered.alerts = filtered.alerts.filter((a) =>
        a.toLowerCase().includes(status.toLowerCase())
      );
    }

    // Filter by mission
    if (mission && typeof mission === 'string') {
      const missionLower = mission.toLowerCase();
      if (!filtered.missionStatus.toLowerCase().includes(missionLower)) {
        filtered = {
          ...filtered,
          alerts: [],
          telemetry: [],
          missionObjectives: [],
          missionCrew: []
        };
      }
    }

    // Filter by date range
    const updatedTime = new Date(filtered.lastUpdated).getTime();
    if (dateFrom && typeof dateFrom === 'string') {
      const fromTime = new Date(dateFrom).getTime();
      if (updatedTime < fromTime) {
        filtered = { ...filtered, alerts: [], telemetry: [] };
      }
    }
    if (dateTo && typeof dateTo === 'string') {
      const toTime = new Date(dateTo).getTime();
      if (updatedTime > toTime) {
        filtered = { ...filtered, alerts: [], telemetry: [] };
      }
    }

    sendSuccess(res, filtered, 'Dashboard snapshot loaded');
  } catch (error) {
    next(error);
  }
});

export default router;