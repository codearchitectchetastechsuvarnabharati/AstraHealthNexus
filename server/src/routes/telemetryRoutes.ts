import { Router } from 'express';
import { collectTelemetrySnapshot, getTelemetryHistory } from '../services/ingestionService.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/telemetry', async (req, res, next) => {
  try {
    const { from, to, limit, offset, onlyAnomalies } = req.query;

    // Validate dates
    if (from && typeof from === 'string' && isNaN(Date.parse(from))) {
      return sendError(res, 400, 'Invalid "from" date format. Use ISO 8601 (e.g. 2024-01-01)', 'INVALID_DATE');
    }
    if (to && typeof to === 'string' && isNaN(Date.parse(to))) {
      return sendError(res, 400, 'Invalid "to" date format. Use ISO 8601 (e.g. 2024-12-31)', 'INVALID_DATE');
    }

    // Parse limit
    let parsedLimit: number | undefined = undefined;
    if (limit !== undefined) {
      const n = Number(limit);
      if (!Number.isInteger(n) || n < 1 || n > 200) {
        return sendError(res, 400, 'Invalid "limit". Must be an integer between 1 and 200', 'INVALID_LIMIT');
      }
      parsedLimit = n;
    }

    // Parse offset
    let parsedOffset: number | undefined = undefined;
    if (offset !== undefined) {
      const n = Number(offset);
      if (!Number.isInteger(n) || n < 0) {
        return sendError(res, 400, 'Invalid "offset". Must be a non-negative integer', 'INVALID_OFFSET');
      }
      parsedOffset = n;
    }

    // Parse onlyAnomalies
    const filterAnomalies = onlyAnomalies === 'true' || onlyAnomalies === '1';

    let records = getTelemetryHistory();

    // Filter by date
    if (from && typeof from === 'string') {
      const fromTime = Date.parse(from);
      records = records.filter((r) => Date.parse(r.timestamp) >= fromTime);
    }
    if (to && typeof to === 'string') {
      const toTime = Date.parse(to);
      records = records.filter((r) => Date.parse(r.timestamp) <= toTime);
    }

    // Filter to anomalies only
    if (filterAnomalies) {
      records = records.filter((r) => r.anomalyCount > 0);
    }

    const total = records.length;
    records.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

    const startLimit = parsedLimit ?? 20;
    const startOffset = parsedOffset ?? 0;
    const paged = records.slice(startOffset, startOffset + startLimit);

    sendSuccess(res, {
      records: paged,
      pagination: {
        limit: startLimit,
        offset: startOffset,
        total,
        returned: paged.length,
        hasMore: startOffset + paged.length < total
      },
      filter: { onlyAnomalies: filterAnomalies }
    }, 'Telemetry history loaded');
  } catch (error) {
    next(error);
  }
});

router.get('/telemetry/live', async (_req, res, next) => {
  try {
    const snapshot = await collectTelemetrySnapshot();
    sendSuccess(res, snapshot, 'Live telemetry snapshot collected');
  } catch (error) {
    next(error);
  }
});

export default router;