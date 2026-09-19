import { setTimeout as delay } from 'node:timers/promises';
import { logEvent } from '../middleware/logger.js';

export class ExternalRequestError extends Error {
  constructor(public readonly reason: 'timeout' | 'cancelled') {
    super(reason === 'timeout' ? 'External request timed out' : 'External request cancelled');
  }
}
export interface ExternalRequestOptions {
  operation: string;
  maxAttempts?: number;
  timeoutMs?: number;
  totalTimeoutMs?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  shouldRetry: (error: unknown) => boolean;
  retryAfterMs?: (error: unknown) => number | undefined;
}

// Owns the sole retry loop. Callers classify safe, temporary failures and consume
// ordinary response bodies inside the operation so timeouts cover body reads too.
export async function externalRequest<T>(
  operation: (signal: AbortSignal, attempt: number) => Promise<T>,
  options: ExternalRequestOptions
): Promise<T> {
  const attempts = options.maxAttempts ?? 3;
  const timeout = options.timeoutMs ?? 5000;
  const total = options.totalTimeoutMs ?? 16000;
  const baseDelay = options.baseDelayMs ?? 200;
  for (const [name, value, min, max] of [
    ['maxAttempts', attempts, 1, 3], ['timeoutMs', timeout, 1, 30000],
    ['totalTimeoutMs', total, 1, 90000], ['baseDelayMs', baseDelay, 0, 1000]
  ] as const) {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`Invalid ${name}`);
  }
  const deadline = performance.now() + total;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (options.signal?.aborted) throw new ExternalRequestError('cancelled');
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw new ExternalRequestError('timeout');
    const controller = new AbortController();
    const cancel = () => controller.abort(new ExternalRequestError('cancelled'));
    options.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(new ExternalRequestError('timeout')), Math.min(timeout, remaining));
    let onAbort: () => void = () => {};
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    let failure: unknown;
    try {
      return await Promise.race([operation(controller.signal, attempt), aborted]);
    } catch (error) {
      failure = controller.signal.aborted ? controller.signal.reason : error;
      controller.abort(); // Release the failed attempt before starting another.
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', onAbort);
      options.signal?.removeEventListener('abort', cancel);
    }
    if (options.signal?.aborted || (failure instanceof ExternalRequestError && failure.reason === 'cancelled')) throw new ExternalRequestError('cancelled');
    const transient = failure instanceof ExternalRequestError ? failure.reason === 'timeout' : options.shouldRetry(failure);
    if (!transient || attempt === attempts) throw failure;
    const backoff = Math.min(baseDelay * 2 ** (attempt - 1), 1000);
    const retryAfter = options.retryAfterMs?.(failure) ?? 0;
    const waitMs = Math.max(backoff, retryAfter);
    // Never retry earlier than Retry-After, or extend the total time budget.
    if (!Number.isFinite(waitMs) || waitMs < 0 || waitMs >= deadline - performance.now()) throw failure;
    logEvent('external_request_retry', { operation: options.operation, attempt, maxAttempts: attempts, delayMs: waitMs });
    try { await delay(waitMs, undefined, { signal: options.signal }); }
    catch { throw new ExternalRequestError('cancelled'); }
  }
  throw new ExternalRequestError('timeout');
}

export function retryAfterMilliseconds(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (/^\d+$/.test(value)) {
    const milliseconds = Number(value) * 1000;
    return Number.isFinite(milliseconds) ? milliseconds : Infinity;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : undefined;
}
