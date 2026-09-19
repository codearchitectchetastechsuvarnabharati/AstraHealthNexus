import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { PaginationQuerySchema } from '../schemas.js';
import { getRequestId } from '../middleware/requestLogger.js';
import { buildAlertSnapshot } from '../services/dashboardService.js';
import { AlertService, alertService, AlertIdSchema, AlertStatusSchema } from '../services/alertService.js';

const ListQuerySchema = PaginationQuerySchema.extend({ status: AlertStatusSchema.optional() });
const ParamsSchema = z.object({ id: AlertIdSchema });
const TransitionSchema = z.object({ status: z.enum(['acknowledged', 'resolved']) }).strict();

// Injectable dependencies let tests exercise real routes with isolated persistent state.
export function createAlertsRouter(service: AlertService = alertService, snapshot = buildAlertSnapshot) {
  const router = Router();
  router.get('/alerts', validate({ query: ListQuerySchema }), async (req, res, next) => {
    try {
      res.json(await service.list(await snapshot(), req.query as unknown as z.infer<typeof ListQuerySchema>));
    } catch (error) { next(error); }
  });
  router.get('/alerts/:id', validate({ params: ParamsSchema, query: z.object({}).strict() }), async (req, res, next) => {
    try {
      res.json({ status: 'success', data: await service.get(String(req.params.id)) });
    } catch (error) { next(error); }
  });
  router.patch('/alerts/:id/status', validate({
    params: ParamsSchema, query: z.object({}).strict(), body: TransitionSchema
  }), async (req, res, next) => {
    try {
      res.json({ status: 'success', data: await service.transition(String(req.params.id), req.body.status, getRequestId(req)) });
    } catch (error) { next(error); }
  });
  return router;
}

export default createAlertsRouter();
