import { authService } from '../services/authService.js';
import type { RequestHandler } from 'express';
import { importSPKI, jwtVerify } from 'jose';
import { logEvent } from './logger.js';
import { getRequestId } from './requestLogger.js';

export interface AuthenticatedIdentity { subject: string; issuer: string; expiresAt: number; sessionId: string }
declare global {
  namespace Express { interface Request { user?: AuthenticatedIdentity } }
}
// Only the server-configured public key is trusted, never keys/URLs from a token.
export function createAuthentication(env: () => NodeJS.ProcessEnv = () => process.env): RequestHandler {
  let cachedPem: string | undefined;
  let cachedKey: ReturnType<typeof importSPKI> | undefined;
  return async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const config = env();
    const pem = config.AUTH_PUBLIC_KEY_PEM?.replace(/\\n/g, '\n');
    const issuer = config.AUTH_ISSUER;
    const audience = config.AUTH_AUDIENCE;
    let key: Awaited<ReturnType<typeof importSPKI>>;
    try {
      if (!pem || !issuer?.trim() || !audience?.trim()) throw new Error();
      if (pem !== cachedPem) { cachedPem = pem; cachedKey = importSPKI(pem, 'RS256'); }
      key = await cachedKey!;
    } catch {
      logEvent('authentication_unavailable', { requestId: getRequestId(req) });
      res.status(503).json({ status: 'error', message: 'Authentication unavailable' }); return;
    }
    const authCount = req.rawHeaders.filter((_, index) => index % 2 === 0 && req.rawHeaders[index].toLowerCase() === 'authorization').length;
    const header = req.headers.authorization;
    const token = typeof header === 'string' && header.length <= 8192 && /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(header) ? header.slice(7) : undefined;
    try {
      if (!token || authCount !== 1) throw new Error();
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['RS256'], issuer, audience, requiredClaims: ['sub', 'exp', 'iat', 'jti'],
        maxTokenAge: '1h', clockTolerance: 0
      });
      if (typeof payload.jti !== 'string' || payload.jti.length > 128 || !payload.jti
        || typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 200
        || typeof payload.iat !== 'number' || typeof payload.exp !== 'number'
        || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)
        || payload.exp <= payload.iat || payload.exp - payload.iat > 3600) throw new Error();
      let active: boolean;
      try { active = await authService.sessionActive(payload.jti!, payload.sub!); }
      catch { res.status(503).json({ status: 'error', message: 'Authentication unavailable' }); return; }
      if (!active) throw new Error();
      req.user = Object.freeze({ subject: payload.sub, issuer: payload.iss!, expiresAt: payload.exp, sessionId: payload.jti });
      next();
    } catch {
      logEvent('authentication_rejected', { requestId: getRequestId(req) });
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ status: 'error', message: 'Valid bearer token required' });
    }
  };
}
export const authenticate = createAuthentication();
