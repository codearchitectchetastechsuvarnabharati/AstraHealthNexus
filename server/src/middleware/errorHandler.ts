import { Request, Response, NextFunction } from 'express';
import { DatasetValidationError } from '../services/datasetLoader.js';

type HttpError = Error & {
  statusCode?: number;
  status?: number;
  code?: string;
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Handle dataset validation errors with a clear 400 response
  if (err instanceof DatasetValidationError) {
    res.status(400).json({
      status: 'error',
      message: err.message,
      code: 'DATASET_VALIDATION_ERROR',
      data: null,
      metadata: { timestamp: new Date().toISOString() },
      pagination: null
    });
    return;
  }

  const error = err as HttpError;
  const statusCode =
    typeof error.statusCode === 'number'
      ? error.statusCode
      : typeof error.status === 'number'
        ? error.status
        : 500;

  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const message = safeStatusCode >= 500
    ? 'Internal server error'
    : error.message || 'Request failed';

  res.status(safeStatusCode).json({
    status: 'error',
    message,
    code: error.code ?? (safeStatusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR')
  });
}