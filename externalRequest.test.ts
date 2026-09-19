import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { externalRequest, retryAfterMilliseconds } from '../src/services/externalRequest.js';
import { forwardRequest } from '../src/services/proxyService.js';
import { NasaService } from '../src/services/nasaService.js';

const policy = { operation: 'test', baseDelayMs: 0, shouldRetry: () => true };
async function serve(t: TestContext, app: express.Express) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test('retry count is bounded and permanent errors stop immediately', async () => {
  let calls = 0;
  await assert.rejects(externalRequest(async () => { calls++; throw new Error('temporary'); }, policy));
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(externalRequest(async () => { calls++; throw new Error('permanent'); }, { ...policy, shouldRetry: () => false }));
  assert.equal(calls, 1);
  calls = 0;
  assert.equal(await externalRequest(async () => { if (++calls < 3) throw new Error('temporary'); return 'ok'; }, policy), 'ok');
  assert.equal(calls, 3);
});

test('total deadline stops a hung operation and aborts its signal', async () => {
  const signals: AbortSignal[] = [];
  const started = performance.now();
  await assert.rejects(externalRequest(async signal => { signals.push(signal); return new Promise(() => {}); }, { ...policy, timeoutMs: 1000, totalTimeoutMs: 40 }), { reason: 'timeout' });
  assert.equal(signals.length, 1);
  assert.ok(signals.every(signal => signal.aborted));
  assert.ok(performance.now() - started < 1000);
});

test('cancellation interrupts an active attempt and retry delay', async () => {
  for (const duringDelay of [false, true]) {
    const controller = new AbortController();
    let calls = 0;
    const timer = setTimeout(() => controller.abort(), 30);
    try {
      await assert.rejects(externalRequest(async () => {
        calls++;
        if (duringDelay) throw new Error('temporary');
        return new Promise(() => {});
      }, { ...policy, signal: controller.signal, baseDelayMs: 200 }), { reason: 'cancelled' });
      assert.equal(calls, 1);
    } finally { clearTimeout(timer); }
  }
});

test('Retry-After delays recovery and prevents retries beyond the budget', async () => {
  let calls = 0;
  const started = performance.now();
  await externalRequest(async () => { if (++calls === 1) throw new Error('busy'); }, { ...policy, retryAfterMs: () => 40 });
  assert.ok(performance.now() - started >= 35);
  calls = 0;
  await assert.rejects(externalRequest(async () => { calls++; throw new Error('busy'); }, { ...policy, totalTimeoutMs: 100, retryAfterMs: () => 200 }));
  assert.equal(calls, 1);
  assert.equal(retryAfterMilliseconds('2'), 2000);
  assert.equal(retryAfterMilliseconds('invalid'), undefined);
  assert.equal(retryAfterMilliseconds(null), undefined);
  const future = new Date(Date.now() + 10000).toUTCString();
  assert.ok(retryAfterMilliseconds(future)! >= 8000);
});

test('invalid retry configuration cannot create unbounded work', async () => {
  for (const override of [{ maxAttempts: 4 }, { timeoutMs: 0 }, { totalTimeoutMs: Infinity }, { baseDelayMs: -1 }]) {
    await assert.rejects(externalRequest(async () => assert.fail('must not execute'), { ...policy, ...override }), RangeError);
  }
});

test('proxy retries temporary reads but never writes, refreshes or permanent statuses', async t => {
  let calls = 0;
  let status = 503;
  let recover = true;
  const app = express();
  app.use(express.json());
  app.use((req, res) => forwardRequest(req, res, 'http://upstream.invalid', (async () => {
    calls++;
    return new Response('result', { status: recover && calls === 2 ? 200 : status });
  }) as typeof fetch));
  const base = await serve(t, app);
  assert.equal((await fetch(base + '/api/external/python/data')).status, 200);
  assert.equal(calls, 2);
  recover = false;
  for (const [method, path] of [['POST', '/data'], ['PATCH', '/data'], ['GET', '/datasets/refresh'], ['GET', '/datasets/%72efresh']]) {
    calls = 0;
    assert.equal((await fetch(base + '/api/external/python' + path, { method })).status, 502);
    assert.equal(calls, 1, method + path);
  }
  for (status of [400, 401, 403, 404, 429, 501]) {
    calls = 0;
    assert.equal((await fetch(base + '/api/external/java/data')).status, status === 501 ? 502 : status);
    assert.equal(calls, 1);
  }
});

test('proxy timeouts include stalled response bodies and exhaust exactly three attempts', async t => {
  let calls = 0;
  const upstream = express();
  upstream.use((_req, res) => { calls++; res.setHeader('content-type', 'application/json'); res.write('{'); });
  const upstreamBase = await serve(t, upstream);
  const app = express();
  app.use((req, res) => forwardRequest(req, res, upstreamBase, fetch, 100));
  const base = await serve(t, app);
  const response = await fetch(base + '/api/external/python/data');
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { status: 'error', message: 'Bad gateway' });
  assert.equal(calls, 3);
});

test('proxy oversized responses fail permanently without retry', async t => {
  let calls = 0;
  const app = express();
  app.use((req, res) => forwardRequest(req, res, 'http://upstream.invalid', (async () => {
    calls++; return new Response('x'.repeat(2 * 1024 * 1024 + 1));
  }) as typeof fetch));
  const base = await serve(t, app);
  assert.equal((await fetch(base + '/api/external/java/data')).status, 502);
  assert.equal(calls, 1);
});

test('NASA respects long Retry-After and does not retry nontransient 501', async () => {
  for (const status of [503, 501]) {
    let calls = 0;
    const service = new NasaService({ apiKey: () => 'test', fetcher: (async () => {
      calls++; return new Response('{}', { status, headers: { 'retry-after': '120' } });
    }) as typeof fetch });
    await assert.rejects(service.get('apod', '2024-09-15'));
    assert.equal(calls, 1);
  }
});
