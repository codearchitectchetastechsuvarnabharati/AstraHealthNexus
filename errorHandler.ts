// codeauthor chetas karnam
import { Request, Response, NextFunction } from 'express';
import { HttpError } from './errors.js';
import { logError } from './logger.js';
import { getRequestId } from './requestLogger.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const parserType = (err as Error & { type?: string }).type;
  const status = err instanceof HttpError ? err.status : parserType === 'entity.parse.failed' ? 400 : parserType === 'entity.too.large' ? 413 : 500;
  logError('request_error', { requestId: getRequestId(_req), method: _req.method, path: _req.path, status, err });
  if (res.headersSent) return _next(err);
  if (parserType === 'entity.parse.failed' || parserType === 'entity.too.large') {
    return res.status(status).json({ status: 'error', message: status === 400 ? 'Malformed JSON body' : 'Request body too large' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json(err.status >= 500 ? { status: 'error', message: 'Internal server error' } : err.toJSON());
  }
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
}
