import { pageItems } from '../middleware/pagination.js';
import { pageCollections } from '../middleware/pagination.js';
import { getRequestId } from '../middleware/requestLogger.js';
// codeauthor chetas karnam
import { Router } from 'express';
import { z } from 'zod';
import { DatasetService } from '../services/datasetService.js';
import { validate } from '../middleware/validation.js';
import { HttpError } from '../middleware/errors.js';
import { DatasetKeySchema, AstronautIdSchema, PaginationQuerySchema, AstronautListQuerySchema } from '../schemas.js';
import { logError } from '../middleware/logger.js';
const router = Router();
const validDatasetKeys = new Set([
    'iss', 'weather', 'spaceWeather', 'astronauts', 'rocket', 'nasa', 'mission'
]);
router.get('/dataset', validate({ query: PaginationQuerySchema }), async (req, res, next) => {
    try {
        const { limit, offset } = req.query;
        // Build the bundle of all datasets but cap the size of large collections
        // (astronauts/crew manifests/objectives) so a single request never
        // returns an unbounded payload.
        const allData = await DatasetService.getAllData();
        const allKeys = Object.keys(allData);
        const bounded = paginateObject({ ...allData }, allKeys, offset, limit);
        res.json({
            status: 'success',
            message: 'Mission dataset page loaded',
            pagination: {
                limit,
                offset,
                returned: bounded.returned.length,
                total: allKeys.length,
                keys: allKeys,
                hasMore: offset + bounded.returned.length < allKeys.length
            },
            ...pageCollections(bounded.data, { limit, offset })
        });
    }
    catch (error) {
        logError('Failed to load dataset', {
            requestId: getRequestId(req),
            method: req.method,
            path: req.originalUrl,
            context: 'GET /dataset',
            err: error
        });
        next(error);
    }
});
router.get('/dataset/catalog', validate({ query: PaginationQuerySchema }), async (req, res, next) => {
    try {
        res.json({ status: 'success', ...pageItems(await DatasetService.getCatalog(), req.query) });
    }
    catch (error) {
        next(error);
    }
});
router.get('/dataset/:datasetKey/metadata', validate({ params: z.object({ datasetKey: DatasetKeySchema }), query: z.object({}).strict() }), async (req, res, next) => {
    try {
        const key = req.params.datasetKey === 'weather' ? 'spaceWeather' : req.params.datasetKey;
        res.json({ status: 'success', data: await DatasetService.getMetadata(key) });
    }
    catch (error) {
        next(error);
    }
});
router.get('/dataset/keys', (_req, res) => {
    res.json({ status: 'success', keys: Array.from(validDatasetKeys) });
});
router.post('/dataset/refresh', validate({ query: z.object({}).strict(), body: z.object({}).strict().optional() }), (req, res, next) => {
    try {
        DatasetService.reloadData();
        res.json({ status: 'success', message: 'Local dataset cache cleared and refreshed' });
    }
    catch (error) {
        logError('Failed to refresh dataset cache', {
            requestId: getRequestId(req),
            method: req.method,
            path: req.originalUrl,
            context: 'POST /dataset/refresh',
            err: error
        });
        next(error);
    }
});
router.get('/dataset/astronauts', validate({ query: AstronautListQuerySchema }), async (req, res, next) => {
    try {
        const { limit, offset, status } = req.query;
        let astronauts = await DatasetService.getAstronautData();
        if (status) {
            astronauts = astronauts.filter((a) => a.status === status);
        }
        const total = astronauts.length;
        const page = astronauts.slice(offset, offset + limit);
        res.json({
            status: 'success',
            pagination: {
                limit,
                offset,
                total,
                returned: page.length,
                hasMore: offset + page.length < total,
                ...(status ? { status } : {})
            },
            data: page
        });
    }
    catch (error) {
        logError('Failed to list astronauts', {
            requestId: getRequestId(req),
            method: req.method,
            path: req.originalUrl,
            context: 'GET /dataset/astronauts',
            err: error
        });
        next(error);
    }
});
router.get('/dataset/astronauts/:id', validate({ params: z.object({ id: AstronautIdSchema }) }), async (req, res, next) => {
    try {
        const id = req.params.id;
        const astronauts = await DatasetService.getAstronautData();
        const astronaut = astronauts.find((crew) => crew.id === id);
        if (!astronaut) {
            throw new HttpError(404, `Astronaut '${id}' not found in local dataset`);
        }
        res.json({ status: 'success', data: astronaut });
    }
    catch (error) {
        logError('Failed to load astronaut data', {
            requestId: getRequestId(req),
            method: req.method,
            path: req.originalUrl,
            context: 'GET /dataset/astronauts/:id',
            err: error
        });
        next(error);
    }
});
router.get('/dataset/:datasetKey', validate({ params: z.object({ datasetKey: DatasetKeySchema }), query: PaginationQuerySchema }), async (req, res, next) => {
    try {
        const key = req.params.datasetKey;
        const payload = key === 'weather'
            ? await DatasetService.getSpaceWeatherData()
            : await DatasetService.getDatasetByKey(key);
        res.json({ status: 'success', ...pageCollections(payload, req.query) });
    }
    catch (error) {
        logError('Failed to load dataset', {
            requestId: getRequestId(req),
            method: req.method,
            path: req.originalUrl,
            context: 'GET /dataset/:datasetKey',
            err: error
        });
        next(error);
    }
});
/**
 * Slice a record object so that only `limit` keys starting at `offset` are
 * returned. This keeps `/api/dataset` bounded even if the bundle grows.
 */
function paginateObject(source, keys, offset, limit) {
    const slice = keys.slice(offset, offset + limit);
    const data = {};
    for (const key of slice) {
        data[key] = source[key];
    }
    return { data, returned: slice };
}
export default router;
