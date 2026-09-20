import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { forwardRequest } from './proxyService.js';
import { getRequestId } from '../middleware/requestLogger.js';
import { PaginationQuerySchema } from '../schemas.js';

export const PYTHON_INTERFACE_VERSION = '1';
const keys = ['iss', 'spaceWeather', 'astronauts', 'rocket', 'nasa', 'mission'] as const;
const page = z.object({ limit: z.number().int().min(1).max(100), offset: z.number().int().nonnegative().safe(), total: z.number().int().nonnegative().safe(), returned: z.number().int().nonnegative().max(100), hasMore: z.boolean() });
const envelope = z.object({ status: z.literal('success'), collections: z.record(page).optional() }).passthrough();

export function createPythonIntegration(baseUrl = process.env.PYTHON_BACKEND_URL ?? 'http://127.0.0.1:5001', fetcher: typeof fetch = fetch): RequestHandler {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Invalid PYTHON_BACKEND_URL');
  return async (req, res) => {
    const requestId = getRequestId(req) ?? randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Astra-Interface-Version', PYTHON_INTERFACE_VERSION);
    res.setHeader('Cache-Control', 'no-store');
    const path = req.originalUrl.split('?')[0].replace(/^\/api\/external\/python/, '');
    const refresh = path === '/api/dataset/refresh';
    const known = ['/health', '/api/dataset', '/api/dataset/keys', '/api/telemetry/live', '/api/nasa/stream'].includes(path)
      || keys.some(key => path === `/api/dataset/${key}`) || /^\/api\/dataset\/astronauts\/ast_[0-9]{3}$/.test(path) || refresh;
    if (!known) { res.status(404).json({ status: 'error', message: 'Endpoint not found' }); return; }
    // Keep the legacy GET refresh interface, but the proxy never retries refreshes.
    if (req.method !== 'GET' && !(refresh && req.method === 'POST')) {
      res.setHeader('Allow', refresh ? 'GET, POST' : 'GET');
      res.status(405).json({ status: 'error', message: 'Method not allowed' }); return;
    }
    if ((req.method === 'POST' && (Object.keys(req.query).length || (req.body !== undefined && !z.object({}).strict().safeParse(req.body).success)))
      || (req.method === 'GET' && (!PaginationQuerySchema.safeParse(req.query).success || Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding']))) {
      res.status(400).json({ status: 'error', message: 'Invalid Python service request' }); return;
    }
    await forwardRequest(req, res, base.origin, fetcher, 5000, {
      headers: { 'X-Request-Id': requestId, 'X-Astra-Interface-Version': PYTHON_INTERFACE_VERSION, Accept: path === '/api/nasa/stream' ? 'text/event-stream' : 'application/json' },
      validateHeaders(response) {
        if (response.headers.get('x-astra-interface-version') !== PYTHON_INTERFACE_VERSION || response.headers.get('x-request-id') !== requestId) throw new Error('Interface mismatch');
        const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
        const expected = path === '/api/nasa/stream' && response.ok ? 'text/event-stream' : 'application/json';
        if (type !== expected) throw new Error('Invalid content type');
      },
      validateBody(status, buffer) {
        const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
        if (status >= 400) { z.object({ status: z.literal('error'), message: z.string() }).parse(payload); return; }
        if (status !== 200) throw new Error('Unexpected status');
        if (path === '/health') { z.object({ status: z.literal('ok'), service: z.literal('astrahealth-python') }).parse(payload); return; }
        envelope.parse(payload);
        if (refresh) z.string().min(1).parse(payload.message);
        else if (path === '/api/dataset/keys') z.array(z.enum(keys)).max(100).parse(payload.keys);
        else if (path === '/api/dataset/astronauts') z.array(z.record(z.unknown())).max(100).parse(payload.data);
        else z.record(z.unknown()).parse(payload.data);
      }
    });
  };
}
