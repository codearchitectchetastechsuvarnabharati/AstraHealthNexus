// codeauthor chetas karnam
import { Response } from 'express';

export interface ApiMetadata {
  timestamp: string;
}

export interface ApiPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function createMetadata(): ApiMetadata {
  return {
    timestamp: new Date().toISOString()
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Request successful',
  pagination: ApiPagination | null = null
) {
  return res.json({
    status: 'success',
    message,
    data,
    metadata: createMetadata(),
    pagination
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  code = 'REQUEST_ERROR'
) {
  return res.status(statusCode).json({
    status: 'error',
    message,
    code,
    data: null,
    metadata: createMetadata(),
    pagination: null
  });
}