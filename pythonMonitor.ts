import { randomUUID } from 'node:crypto';
import { externalRequest, ExternalRequestError } from './externalRequest.js';
import { logEvent } from '../middleware/logger.js';
import { PYTHON_INTERFACE_VERSION } from './pythonIntegration.js';

type Failure = 'unavailable' | 'timeout' | 'http_error' | 'interface_mismatch' | 'invalid_response';
export interface PythonHealth {
  service: 'astrahealth-python';
  status: 'unknown' | 'available' | 'unavailable';
  checkedAt: string | null;
  lastSuccessAt: string | null;
  responseTimeMs: number | null;
  consecutiveFailures: number;
  failure: { code: Failure; message: string } | null;
}
const messages: Record<Failure, string> = {
  unavailable: 'Python service could not be reached', timeout: 'Python health check timed out',
  http_error: 'Python health endpoint returned an unsuccessful status',
  interface_mismatch: 'Python service interface is incompatible', invalid_response: 'Python health response is invalid'
};
class ProbeError extends Error { constructor(readonly code: Failure) { super(messages[code]); } }

export class PythonMonitor {
  private state: PythonHealth = { service: 'astrahealth-python', status: 'unknown', checkedAt: null, lastSuccessAt: null, responseTimeMs: null, consecutiveFailures: 0, failure: null };
  private pending?: Promise<PythonHealth>;
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private running = false;
  private generation = 0;
  private readonly url: URL;
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private checkedMono = -Infinity;
  constructor(private readonly options: { baseUrl?: string; fetcher?: typeof fetch; intervalMs?: number; timeoutMs?: number } = {}) {
    this.url = new URL(options.baseUrl ?? process.env.PYTHON_BACKEND_URL ?? 'http://127.0.0.1:5001');
    if (!['http:', 'https:'].includes(this.url.protocol) || this.url.username || this.url.password || this.url.search || this.url.hash || this.url.pathname !== '/') throw new Error('Invalid PYTHON_BACKEND_URL');
    this.url.pathname = '/health';
    this.intervalMs = options.intervalMs ?? 15000;
    this.timeoutMs = options.timeoutMs ?? 2000;
    if (!Number.isSafeInteger(this.intervalMs) || this.intervalMs < 1 || this.intervalMs > 300000 || !Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 30000) throw new Error('Invalid Python monitor timing');
  }
  snapshot(): PythonHealth { return structuredClone(this.state); }
  async current(): Promise<PythonHealth> {
    return performance.now() - this.checkedMono < this.intervalMs ? this.snapshot() : this.check();
  }
  start() {
    if (this.running) return;
    this.running = true;
    const generation = ++this.generation;
    const poll = async () => {
      await this.check();
      if (this.running && generation === this.generation) { this.timer = setTimeout(poll, this.intervalMs); this.timer.unref(); }
    };
    void poll();
  }
  stop() { this.running = false; this.generation++; clearTimeout(this.timer); this.controller?.abort(); }
  async check(): Promise<PythonHealth> {
    if (this.pending) return structuredClone(await this.pending);
    const controller = new AbortController();
    this.controller = controller;
    this.pending = this.probe(controller.signal).finally(() => { this.pending = undefined; this.controller = undefined; });
    return structuredClone(await this.pending);
  }
  private async probe(signal: AbortSignal): Promise<PythonHealth> {
    const started = performance.now();
    let failure: Failure | null = null;
    const requestId = randomUUID();
    try {
      await externalRequest(async attemptSignal => {
        let response: Response | undefined;
        try {
          response = await (this.options.fetcher ?? fetch)(this.url, { redirect: 'error', signal: attemptSignal, headers: { Accept: 'application/json', 'X-Request-Id': requestId, 'X-Astra-Interface-Version': PYTHON_INTERFACE_VERSION } });
          if (response.status !== 200) throw new ProbeError('http_error');
          if (response.headers.get('x-astra-interface-version') !== PYTHON_INTERFACE_VERSION || response.headers.get('x-request-id') !== requestId) throw new ProbeError('interface_mismatch');
          if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ProbeError('invalid_response');
          const reader = response.body?.getReader();
          if (!reader) throw new ProbeError('invalid_response');
          const chunks: Uint8Array[] = [];
          let size = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.length;
              if (size > 16384) throw new ProbeError('invalid_response');
              chunks.push(value);
            }
          } finally { reader.releaseLock(); }
          try {
            const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
            if (body?.status !== 'ok' || body?.service !== 'astrahealth-python') throw new Error();
          } catch { throw new ProbeError('invalid_response'); }
        } finally { void response?.body?.cancel().catch(() => undefined); }
      }, { operation: 'python_health', maxAttempts: 1, timeoutMs: this.timeoutMs, totalTimeoutMs: this.timeoutMs, signal, shouldRetry: () => false });
    } catch (error) {
      if (signal.aborted) return this.snapshot();
      failure = error instanceof ProbeError ? error.code : error instanceof ExternalRequestError ? 'timeout' : 'unavailable';
    }
    const checkedAt = new Date().toISOString();
    const previous = this.state;
    this.state = {
      service: 'astrahealth-python', status: failure ? 'unavailable' : 'available', checkedAt,
      lastSuccessAt: failure ? previous.lastSuccessAt : checkedAt,
      responseTimeMs: Math.round(performance.now() - started),
      consecutiveFailures: failure ? previous.consecutiveFailures + 1 : 0,
      failure: failure ? { code: failure, message: messages[failure] } : null
    };
    this.checkedMono = performance.now();
    if (previous.status !== this.state.status || previous.failure?.code !== this.state.failure?.code) {
      logEvent('python_availability_changed', { status: this.state.status, reason: failure, consecutiveFailures: this.state.consecutiveFailures });
    }
    return this.snapshot();
  }
}
