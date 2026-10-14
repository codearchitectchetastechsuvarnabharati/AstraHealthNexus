import { Router } from 'express';
import { collectTelemetrySnapshot, getTelemetryHistory } from '../services/ingestionService.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();

/**
 * GET /api/telemetry
 * Query params:
 *   - from    (ISO date)  filter records after this time
 *   - to      (ISO date)  filter records before this time
 *   - limit   (number)    max records to return (default 20, max 200)
 *   - offset  (number)    skip N records (default 0)
 */
router.get('/telemetry', async (req, res, next) => {
  try {
    const { from, to, limit, offset } = req.query;

    // Validate from/to dates
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

    const history = getTelemetryHistory({
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
      limit: parsedLimit,
      offset: parsedOffset
    });

    sendSuccess(res, history, 'Telemetry history loaded');
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