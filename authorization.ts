import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { logEvent } from './logger.js';
import { getRequestId } from './requestLogger.js';

type Permission = 'read' | 'operate' | 'refresh' | 'self';
const grants: Record<UserRole, readonly Permission[]> = {
  viewer: ['read', 'self'], operator: ['read', 'operate', 'self'], admin: ['read', 'operate', 'refresh', 'self']
};
// Explicit route policy: a new endpoint is denied until its permission is assigned.
export function requiredPermission(method: string, path: string): Permission | undefined {
  // These endpoints only use ASCII identifiers; reject ambiguous encoded paths.
  if (path.includes('%') || path.includes('\\') || path.includes('//')) return undefined;
  path = path.toLowerCase().replace(/\/$/, '');
  if (path === '/auth/me' && ['GET', 'HEAD'].includes(method)) return 'self';
  if (path === '/auth/logout' && method === 'POST') return 'self';
  const external = /^\/external\/(python|java)(\/.*)$/.exec(path);
  if (external) {
    path = external[2];
    if (path === '/api/dataset/refresh' && ['GET', 'HEAD', 'POST'].includes(method)) return 'refresh';
    if (!['GET', 'HEAD'].includes(method)) return undefined;
    if (['/health', '/api/health', '/api/telemetry/live', '/api/nasa/stream'].includes(path)
      || /^\/api\/dataset(?:\/[a-z0-9_-]+)?$/.test(path)
      || /^\/api\/dataset\/astronauts\/[a-z0-9_-]+$/.test(path)) return 'read';
    return undefined;
  }
  if (path === '/dataset/refresh') return method === 'POST' ? 'refresh' : undefined;
  if (path === '/telemetry/records' && method === 'POST') return 'operate';
  if (/^\/alerts\/[^/]+\/status$/.test(path) && method === 'PATCH') return 'operate';
  if (!['GET', 'HEAD'].includes(method)) return undefined;
  if (['/dashboard', '/telemetry', '/telemetry/live', '/telemetry/records', '/telemetry/options', '/nasa/apod', '/nasa/asteroids', '/nasa/stream', '/health/python'].includes(path)
    || /^\/alerts(?:\/[^/]+)?$/.test(path)
    || /^\/dataset(?:\/[^/]+)?$/.test(path)
    || /^\/dataset\/[^/]+\/metadata$/.test(path)
    || /^\/dataset\/astronauts\/[^/]+$/.test(path)) return 'read';
  return undefined;
}
export const authorize: RequestHandler = (req, res, next) => {
  if (!req.user) { res.status(401).json({ status: 'error', message: 'Authentication required' }); return; }
  const permission = requiredPermission(req.method, req.path);
  const allowed = Object.prototype.hasOwnProperty.call(grants, req.user.role) && permission && grants[req.user.role].includes(permission);
  if (!allowed) {
    logEvent('authorization_denied', { requestId: getRequestId(req), role: req.user.role });
    res.status(403).json({ status: 'error', message: 'Permission denied' }); return;
  }
  next();
};
