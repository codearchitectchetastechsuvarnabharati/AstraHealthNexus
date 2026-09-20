import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createPythonIntegration } from '../src/services/pythonIntegration.js';
import { requestLogger } from '../src/middleware/requestLogger.js';

async function serve(t: TestContext, fetcher?: typeof fetch, upstream = 'http://127.0.0.1:5001') {
  const app = express();
  app.use(requestLogger);
  app.use(express.json());
  app.use('/api/external/python', createPythonIntegration(upstream, fetcher));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/external/python`;
}

test('Node rejects unsupported methods, routes and parameters before contacting Python', async t => {
  let calls = 0;
  const base = await serve(t, (async () => { calls++; throw new Error('must not call'); }) as typeof fetch);
  for (const [path, method, status] of [['/unknown', 'GET', 404], ['/health', 'DELETE', 405], ['/api/dataset?limit=0', 'GET', 400], ['/api/dataset?limit=1&limit=2', 'GET', 400], ['/api/dataset/refresh?unknown=1', 'POST', 400]]) {
    assert.equal((await fetch(base + path, { method })).status, status);
  }
  assert.equal((await fetch(base + '/api/dataset/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"unexpected":1}' })).status, 400);
  assert.equal(calls, 0);
});

test('invalid Python interface responses fail safely without retry', async t => {
  for (const kind of ['version', 'requestId', 'contentType', 'json', 'envelope', 'data']) {
    let calls = 0;
    const base = await serve(t, (async (_url, init) => {
      calls++;
      const incoming = new Headers(init?.headers);
      const headers = { 'x-astra-interface-version': kind === 'version' ? '2' : '1', 'x-request-id': kind === 'requestId' ? 'wrong' : incoming.get('x-request-id')!, 'content-type': kind === 'contentType' ? 'text/html' : 'application/json' };
      const body = kind === 'json' ? 'private invalid data' : JSON.stringify(kind === 'envelope' ? { status: 'ok' } : { status: 'success', data: kind === 'data' ? null : {} });
      return new Response(body, { headers });
    }) as typeof fetch);
    const response = await fetch(base + '/api/dataset/iss');
    assert.equal(response.status, 502, kind);
    assert.deepEqual(await response.json(), { status: 'error', message: 'Bad gateway' });
    assert.equal(calls, 1);
  }
});

test('Node communicates with a real Python service for health, datasets, refresh and stream', async t => {
  const child = spawn('python', ['-u', '-c', "from python_backend import MissionHandler, ThreadingHTTPServer; s=ThreadingHTTPServer(('127.0.0.1',0),MissionHandler); print(s.server_port,flush=True); s.serve_forever()"], { cwd: fileURLToPath(new URL('..', import.meta.url)), windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  t.after(async () => { if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } });
  const port = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Python startup timed out')), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Python exited before readiness')); });
    let output = '';
    child.stdout.on('data', data => { output += data; if (output.includes('\n')) { clearTimeout(timer); resolve(output.trim()); } });
  });
  const base = await serve(t, fetch, `http://127.0.0.1:${port}`);
  for (const path of ['/health', '/api/dataset/keys', '/api/dataset/iss', '/api/dataset/astronauts', '/api/dataset', '/api/telemetry/live']) {
    const response = await fetch(base + path + '?limit=1');
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-astra-interface-version'), '1');
    assert.ok(response.headers.get('x-request-id'));
    const payload = await response.json();
    if (path === '/api/dataset/astronauts') { assert.equal(payload.data.length, 1); assert.equal(payload.collections.data.limit, 1); }
  }
  const refresh = await fetch(base + '/api/dataset/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(refresh.status, 200);
  assert.equal((await refresh.json()).status, 'success');
  const controller = new AbortController();
  const stream = await fetch(base + '/api/nasa/stream?limit=1', { signal: controller.signal });
  assert.equal(stream.status, 200);
  assert.equal(stream.headers.get('content-type'), 'text/event-stream');
  const chunk = await stream.body!.getReader().read();
  assert.ok(new TextDecoder().decode(chunk.value).startsWith('data: '));
  controller.abort();
});

test('configured Python URL must be an HTTP origin without credentials', () => {
  for (const value of ['file:///tmp/test', 'http://user:pass@localhost', 'http://localhost/api', 'http://localhost?key=secret']) {
    assert.throws(() => createPythonIntegration(value));
  }
});
