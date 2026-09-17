import { validate } from '../middleware/validation.js';
import { PaginationQuerySchema } from '../schemas.js';
import { pageCollections } from '../middleware/pagination.js';
import { getRequestId } from '../middleware/requestLogger.js';
// codeauthor chetas karnam
import { Router } from 'express';
import { buildAlertSnapshot } from '../services/dashboardService.js';
import { logError } from '../middleware/logger.js';
const router = Router();
router.get('/alerts', validate({ query: PaginationQuerySchema }), async (req, res, next) => {
    try {
        const alertSnapshot = await buildAlertSnapshot();
        const page = pageCollections(alertSnapshot, req.query);
        res.json({ ...page.data, collections: page.collections });
    }
    catch (error) {
        logError('Failed to load alerts', {
            requestId: getRequestId(req),
            method: req.method,
            path: req.originalUrl,
            context: 'GET /alerts',
            err: error
        });
        next(error);
    }
});
export default router;
