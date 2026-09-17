// codeauthor chetas karnam
import { randomUUID } from 'crypto';
import { Request, RequestHandler } from 'express';
import { logRequest } from './logger.js';

/**
 * Request logger middleware.
 *
 * - Assigns a UUID requestId to every request (echoed in the `X-Request-Id`
 *   response header so clients and proxies can correlate failures).
 * - Logs a single structured line per request with method, path, status,
 *   and durationMs.
 * - Logs server-side errors (status >= 500) at error level so they are easy
 *   to filter out of the request stream.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  (req as Request & { requestId?: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const requestPath = req.originalUrl.split('?')[0];
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const ctx = {
      requestId,
      method: req.method,
      path: requestPath,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined
    };
    logRequest(ctx);

  });

  next();
};

export function getRequestId(req: Request): string | undefined {
  return (req as Request & { requestId?: string }).requestId;
}
