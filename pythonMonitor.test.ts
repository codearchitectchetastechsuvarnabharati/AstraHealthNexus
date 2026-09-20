import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { PythonMonitor } from '../src/services/pythonMonitor.js';
import { createServiceHealthRouter } from '../src/routes/serviceHealthRoutes.js';

function response(init?: RequestInit, body: unknown = { status: 'ok', service: 'astrahealth-python' }, overrides = {}) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'x-astra-interface-version': '1', 'x-request-id': new Headers(init?.headers).get('x-request-id')!, ...overrides } });
}
async function serve(t: TestContext, app: express.Express) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test('monitor reports failure, retains last success and detects recovery', async () => {
  let failing = false;
  const monitor = new PythonMonitor({ fetcher: (async (_url, init) => { if (failing) throw new Error('secret URL'); return response(init); }) as typeof fetch });
  assert.equal(monitor.snapshot().status, 'unknown');
  const first = await monitor.check();
  assert.equal(first.status, 'available');
  assert.ok(first.checkedAt);
  failing = true;
  const failed = await monitor.check();
  assert.equal(failed.failure?.code, 'unavailable');
  assert.equal(failed.lastSuccessAt, first.lastSuccessAt);
  assert.equal(failed.consecutiveFailures, 1);
  assert.equal((await monitor.check()).consecutiveFailures, 2);
  assert.ok(!JSON.stringify(failed).includes('secret'));
  failing = false;
  const recovered = await monitor.check();
  assert.equal(recovered.status, 'available');
  assert.equal(recovered.failure, null);
  assert.equal(recovered.consecutiveFailures, 0);
});

test('concurrent health requests share one probe and recent results prevent request storms', async () => {
  let calls = 0;
  const monitor = new PythonMonitor({ fetcher: (async (_url, init) => { calls++; await delay(10); return response(init); }) as typeof fetch });
  const results = await Promise.all(Array.from({ length: 20 }, () => monitor.current()));
  assert.equal(calls, 1);
  results[0].status = 'unavailable';
  assert.equal(results[1].status, 'available');
  assert.equal((await monitor.current()).status, 'available');
  assert.equal(calls, 1);
});

test('monitor safely classifies HTTP failures, version mismatch and malformed payloads', async () => {
  const cases: Array<[string, (init?: RequestInit) => Response]> = [
    ['http_error', () => new Response('private error', { status: 503 })],
    ['interface_mismatch', init => response(init, {}, { 'x-astra-interface-version': '2' })],
    ['interface_mismatch', init => response(init, {}, { 'x-request-id': 'wrong' })],
    ['invalid_response', init => response(init, { status: 'ok', service: 'wrong' })],
    ['invalid_response', init => response(init, {}, { 'content-type': 'text/html' })],
    ['invalid_response', init => response(init, { oversized: 'x'.repeat(17000) })]
  ];
  for (const [code, make] of cases) {
    let calls = 0;
    const monitor = new PythonMonitor({ fetcher: (async (_url, init) => { calls++; return make(init); }) as typeof fetch });
    assert.equal((await monitor.check()).failure?.code, code);
    assert.equal(calls, 1);
  }
});

test('timeouts cover slow headers and bodies on real HTTP connections', async t => {
  for (const body of [false, true]) {
    const upstream = express();
    upstream.get('/health', (req, res) => {
      if (body) {
        res.set({ 'content-type': 'application/json', 'x-astra-interface-version': '1', 'x-request-id': req.header('x-request-id')! });
        res.write('{');
      }
    });
    const baseUrl = await serve(t, upstream);
    const monitor = new PythonMonitor({ baseUrl, timeoutMs: 100 });
    assert.equal((await monitor.check()).failure?.code, 'timeout');
  }
});

test('health API returns 503 failure information and 200 on recovery', async t => {
  let available = false;
  const monitor = new PythonMonitor({ fetcher: (async (_url, init) => { if (!available) throw new Error('secret'); return response(init); }) as typeof fetch });
  const app = express();
  app.use('/api', createServiceHealthRouter(monitor));
  const base = await serve(t, app);
  const failed = await fetch(base + '/api/health/python');
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('cache-control'), 'no-store');
  assert.equal(failed.headers.get('retry-after'), '15');
  const payload = await failed.json();
  assert.equal(payload.status, 'degraded');
  assert.equal(payload.dependency.failure.code, 'unavailable');
  available = true;
  await monitor.check();
  const recovered = await fetch(base + '/api/health/python');
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).dependency.status, 'available');
});

test('background polling detects changes and stops without overlapping probes', async () => {
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const monitor = new PythonMonitor({ intervalMs: 10, fetcher: (async (_url, init) => {
    calls++; active++; maxActive = Math.max(active, maxActive);
    await delay(10); active--;
    return response(init);
  }) as typeof fetch });
  try {
    monitor.start(); monitor.start();
    const deadline = Date.now() + 2000;
    while (calls < 3 && Date.now() < deadline) await delay(10);
    assert.ok(calls >= 3);
    assert.equal(maxActive, 1);
  } finally { monitor.stop(); }
  const stopped = calls;
  await delay(60);
  assert.equal(calls, stopped);
});

test('stopping an active probe cancels it without a false outage', async () => {
  let signal: AbortSignal | undefined;
  const monitor = new PythonMonitor({ fetcher: (async (_url, init) => { signal = init?.signal as AbortSignal; return new Promise(() => {}); }) as typeof fetch });
  const pending = monitor.check();
  monitor.stop();
  assert.equal((await pending).status, 'unknown');
  assert.ok(signal?.aborted);
});
