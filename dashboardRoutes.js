import { validate } from '../middleware/validation.js';
import { PaginationQuerySchema } from '../schemas.js';
import { pageCollections } from '../middleware/pagination.js';
import { getRequestId } from '../middleware/requestLogger.js';
// codeauthor chetas karnam
import { Router } from 'express';
import { buildDashboardSnapshot } from '../services/dashboardService.js';
import { logError } from '../middleware/logger.js';
const router = Router();
router.get('/dashboard', validate({ query: PaginationQuerySchema }), async (req, res, next) => {
    try {
        const snapshot = await buildDashboardSnapshot();
        const page = pageCollections(snapshot, req.query);
        res.json({ ...page.data, collections: page.collections });
    }
    catch (error) {
        logError('Failed to load dashboard snapshot', {
            requestId: getRequestId(req),
            method: req.method,
            path: req.originalUrl,
            context: 'GET /dashboard',
            err: error
        });
        next(error);
    }
});
export default router;
