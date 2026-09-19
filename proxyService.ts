import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { logServiceFailure } from '../middleware/logger.js';
import { getRequestId } from '../middleware/requestLogger.js';
import { externalRequest, ExternalRequestError, retryAfterMilliseconds } from './externalRequest.js';

class ProxyFailure extends Error {
  constructor(public readonly transient: boolean, message: string, public readonly retryAfterMs?: number) { super(message); }
}

export async function forwardRequest(req: Request, res: Response, targetBase: string, fetcher: typeof fetch = fetch, timeoutMs = 5000) {
  const lifetime = new AbortController();
  const disconnect = () => lifetime.abort();
  res.once('close', disconnect);
  req.once('aborted', disconnect);
  try {
    const suffix = req.originalUrl.replace(/^\/api\/external\/(python|java)/, '');
    const url = new URL(targetBase);
    const separator = suffix.indexOf('?');
    url.pathname = (separator < 0 ? suffix : suffix.slice(0, separator)) || '/';
    url.search = separator < 0 ? '' : suffix.slice(separator);
    const safeRead = ['GET', 'HEAD'].includes(req.method) && !decodeURIComponent(url.pathname).replace(/\/+$/, '').endsWith('/refresh');
    const headers: Record<string, string> = {};
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    const result = await externalRequest(async signal => {
      let upstream: globalThis.Response | undefined;
      try {
        upstream = await fetcher(url, {
          method: req.method, headers, signal, redirect: 'error',
          ...(['POST', 'PUT', 'PATCH'].includes(req.method) && req.body !== undefined ? { body: JSON.stringify(req.body) } : {})
        });
        if (upstream.status >= 500) throw new ProxyFailure([500, 502, 503, 504].includes(upstream.status), 'Upstream server failure', retryAfterMilliseconds(upstream.headers.get('retry-after')));
        const contentType = upstream.headers.get('content-type') || 'application/json';
        const retryAfter = upstream.headers.get('retry-after');
        if (contentType.includes('text/event-stream') && upstream.body && upstream.ok) {
          return { status: upstream.status, contentType, retryAfter, stream: upstream.body, buffer: undefined };
        }
        const reader = upstream.body?.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.length;
              if (size > 2 * 1024 * 1024) throw new ProxyFailure(false, 'Upstream payload too large');
              chunks.push(value);
            }
          } finally { reader.releaseLock(); }
        }
        return { status: upstream.status, contentType, retryAfter, buffer: Buffer.concat(chunks), stream: undefined };
      } catch (error) {
        // Never include raw fetch error text or URLs in logs/responses.
        void upstream?.body?.cancel().catch(() => undefined);
        if (error instanceof ProxyFailure) throw error;
        if (signal.aborted) throw signal.reason;
        throw new ProxyFailure(true, 'Upstream connection failed');
      }
    }, {
      operation: 'external_backend_proxy', timeoutMs, totalTimeoutMs: Math.min(timeoutMs * (safeRead ? 3 : 1) + (safeRead ? 1000 : 0), 90000),
      maxAttempts: safeRead ? 3 : 1, signal: lifetime.signal,
      shouldRetry: error => error instanceof ProxyFailure && error.transient,
      retryAfterMs: error => error instanceof ProxyFailure ? error.retryAfterMs : undefined
    });
    if (res.destroyed) return;
    res.status(result.status).setHeader('Content-Type', result.contentType);
    if (result.retryAfter && /^\d+$/.test(result.retryAfter)) res.setHeader('Retry-After', result.retryAfter);
    if (result.stream) {
      // Once streaming begins, never reconnect/replay events automatically.
      await pipeline(Readable.fromWeb(result.stream as any), res, { signal: lifetime.signal });
    } else res.send(result.buffer);
  } catch (err) {
    if (lifetime.signal.aborted) return;
    logServiceFailure('proxy_failed', { service: 'proxy', requestId: getRequestId(req), err: err instanceof ExternalRequestError || err instanceof ProxyFailure ? err : new Error('External request failed') });
    if (err instanceof ProxyFailure && err.retryAfterMs !== undefined && Number.isFinite(err.retryAfterMs)) res.setHeader('Retry-After', String(Math.ceil(err.retryAfterMs / 1000)));
    if (!res.headersSent && !res.destroyed) res.status(502).json({ status: 'error', message: 'Bad gateway' });
    else if (!res.destroyed) res.end();
  } finally {
    res.off('close', disconnect);
    req.off('aborted', disconnect);
  }
}
