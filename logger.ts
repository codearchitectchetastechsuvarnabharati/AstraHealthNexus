// codeauthor chetas karnam
import winston from 'winston';

/**
 * Structured JSON logger.
 *
 * Emits one JSON object per log line with consistent fields:
 *   timestamp, level, message, service, event, ...context
 *
 * `service` is always 'astrahealth-nexus-server' so log aggregators can
 * distinguish it from the Python and Java backends.
 *
 * Convenience helpers (logRequest, logError, logEvent) add context fields
 * like requestId, method, path, status, durationMs so that callers don't
 * have to repeat the shape.
 */
const SERVICE_NAME = 'astrahealth-nexus-server';

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  defaultMeta: { service: SERVICE_NAME },
  format: baseFormat,
  transports: [new winston.transports.Console()]
});

export interface RequestLogContext {
  requestId: string;
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
}

export interface ErrorLogContext {
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  err?: unknown;
  context?: string;
}

export function logRequest(ctx: RequestLogContext) {
  logger.info('http_request', {
    event: 'request',
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    status: ctx.status,
    durationMs: ctx.durationMs,
    ip: ctx.ip,
    userAgent: ctx.userAgent
  });
}

export function logError(message: string, ctx: ErrorLogContext = {}) {
  const err = ctx.err;
  const errorInfo =
    err instanceof Error
      ? {
          errorName: err.name,
          errorMessage: err.message,
          stack: err.stack,
          ...(ctx.status !== undefined ? { status: ctx.status } : {})
        }
      : { errorValue: String(err) };

  logger.error(message, {
    event: 'error',
    context: ctx.context,
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    status: ctx.status,
    ...errorInfo
  });
}

export function logEvent(message: string, meta: Record<string, unknown> = {}) {
  logger.info(message, { event: meta.event ?? 'service_event', ...meta });
}

export function logServiceFailure(message: string, ctx: ErrorLogContext & { service: string }) {
  const err = ctx.err;
  logger.error(message, {
    event: 'service_failure',
    service: ctx.service,
    context: ctx.context,
    requestId: ctx.requestId,
    errorName: err instanceof Error ? err.name : undefined,
    errorMessage: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  });
}

export { logger };
