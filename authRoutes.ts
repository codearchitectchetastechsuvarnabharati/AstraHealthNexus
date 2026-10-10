import { Router, json } from 'express';
import rateLimit from 'express-rate-limit';
import { authService, AuthError, CredentialsSchema } from '../services/authService.js';

export const loginRouter = Router();
loginRouter.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ status: 'error', message: 'Too many login attempts' }) }),
  (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!req.is('application/json')) { res.status(415).json({ status: 'error', message: 'Content-Type must be application/json' }); return; }
    next();
  }, json({ limit: '4kb' }), async (req, res) => {
    const input = CredentialsSchema.safeParse(req.body);
    if (!input.success) { res.status(400).json({ status: 'error', message: 'Invalid login request' }); return; }
    try { res.json({ status: 'success', data: await authService.login(input.data.email, input.data.password) }); }
    catch (error) {
      const safe = error instanceof AuthError ? error : new AuthError(503, 'Authentication temporarily unavailable');
      res.status(safe.status).json({ status: 'error', message: safe.message });
    }
  });
export const sessionRouter = Router();
sessionRouter.post('/auth/logout', async (req, res) => {
  try {
    await authService.logout(req.user!.sessionId, req.user!.subject);
    res.json({ status: 'success', message: 'Logged out' });
  } catch { res.status(503).json({ status: 'error', message: 'Authentication temporarily unavailable' }); }
});
