import { telemetryRecords } from '../services/telemetryRecordsService.js';
import { DATASET_SOURCES, TELEMETRY_CATEGORIES } from '../services/datasetCatalog.js';
import { TelemetryRecordsQuerySchema } from '../schemas.js';
import { z } from 'zod';
import { getRequestId } from '../middleware/requestLogger.js';
// codeauthor chetas karnam
import { Router } from 'express';
import { collectTelemetrySnapshot, getTelemetryHistory } from '../services/ingestionService.js';
import { validate } from '../middleware/validation.js';
import { TelemetryQuerySchema } from '../schemas.js';
import { logError } from '../middleware/logger.js';
const router = Router();
router.post('/telemetry/records', validate({ query: z.object({}).strict() }), (req, res, next) => {
    try {
        const result = telemetryRecords.ingest(req.body, getRequestId(req));
        res.status(201).json({ status: 'success', ...result });
    }
    catch (error) {
        next(error);
    }
});
router.get('/telemetry/records', validate({ query: TelemetryRecordsQuerySchema }), (req, res) => {
    res.json({ status: 'success', ...telemetryRecords.query(req.query) });
});
router.get('/telemetry/options', validate({ query: z.object({}).strict() }), (_req, res) => {
    res.json({ status: 'success', sources: DATASET_SOURCES, categories: TELEMETRY_CATEGORIES,
        missions: telemetryRecords.missions(), timestampBasis: 'record-time', timestampDetails: { collected: 'collection-time', submitted: 'sender-observation-time' }, order: 'newest-first' });
});
router.get('/telemetry', validate({ query: TelemetryQuerySchema }), async (req, res, next) => {
    try {
        const { limit, offset, since } = req.query;
        const snapshot = await collectTelemetrySnapshot();
        let history = getTelemetryHistory();
        if (since) {
            const sinceMs = Date.parse(since);
            if (!Number.isNaN(sinceMs)) {
                history = history.filter((entry) => Date.parse(entry.timestamp) >= sinceMs);
            }
        }
        const total = history.length;
        const page = history.slice(offset, offset + limit);
        res.json({
            snapshot,
            pagination: {
                limit,
                offset,
                total,
                returned: page.length,
                hasMore: offset + page.length < total
            },
            history: page
        });
    }
    catch (error) {
        logError('Failed to collect telemetry', {
            requestId: getRequestId(req),
            method: req.method,
            path: req.originalUrl,
            context: 'GET /telemetry',
            err: error
        });
        next(error);
    }
});
router.get('/telemetry/live', validate({ query: TelemetryQuerySchema.pick({ limit: true, offset: true }) }), async (req, res, next) => {
    try {
        const snapshot = await collectTelemetrySnapshot();
        const history = getTelemetryHistory();
        const { limit, offset } = req.query;
        const page = history.slice(offset, offset + limit);
        res.json({
            ...snapshot,
            history: {
                limit,
                offset,
                returned: page.length,
                total: history.length,
                hasMore: offset + page.length < history.length,
                items: page
            }
        });
    }
    catch (error) {
        logError('Failed to collect live telemetry', {
            requestId: getRequestId(req),
            method: req.method,
            path: req.originalUrl,
            context: 'GET /telemetry/live',
            err: error
        });
        next(error);
    }
});
export default router;
