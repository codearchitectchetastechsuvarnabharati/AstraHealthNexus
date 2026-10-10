import { authenticatedFetch as fetch } from './authTestSupport.js';
// codeauthor chetas karnam
/**
 * Failure-mode tests for the AstraHealth Nexus backend.
 *
 * These tests intentionally drive the API into failure states and assert
 * that the server responds safely rather than crashing or leaking internals:
 *
 *   1. Malformed requests / wrong types / missing params
 *      -> rejected by Zod with HTTP 400 and a structured `issues` array.
 *   2. Invalid dataset shapes (missing required fields, wrong types)
 *      -> rejected by DatasetLoader with TypeError.
 *   3. Service failures (e.g. dashboard build throws)
 *      -> surfaced as HTTP 500 via the central error handler with a
 *         structured payload.
 *   4. External API unavailable (Python/Java upstream refused)
 *      -> proxied as HTTP 502 Bad Gateway.
 *   5. Database/file-system read failures
 *      -> logged as service_failure and surfaced as HTTP 500.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

// Routes
import { validate } from '../src/middleware/validation.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requestLogger } from '../src/middleware/requestLogger.js';
import { DatasetLoader } from '../src/services/datasetLoader.js';
import { HttpError } from '../src/middleware/errors.js';
import {
  DatasetKeySchema,
  AstronautIdSchema,
  PaginationQuerySchema,
  AstronautListQuerySchema,
  TelemetryQuerySchema
} from '../src/schemas.js';
import { z } from 'zod';

interface Harness {
  url: string;
  close: () => Promise<void>;
}

async function startServer(app: express.Express): Promise<Harness> {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          })
      });
    });
  });
}

async function getJson(url: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url);
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, body };
}

async function postJson(url: string, body: unknown): Promise<{ status: number; body: any }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  const text = await res.text();
  let parsed: any = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, body: parsed };
}

// ---------------------------------------------------------------------------
// 1. Malformed requests / wrong types / missing params
// ---------------------------------------------------------------------------

test('validation: rejects missing dataset key param with 400 + issues', async () => {
  const app = express();
  app.use(express.json());
  app.get(
    '/dataset/:datasetKey?',
    validate({ params: z.object({ datasetKey: DatasetKeySchema }) }),
    (_req, res) => res.json({ ok: true })
  );
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    const { status, body } = await getJson(`${url}/dataset/`); // express drops trailing slash param
    // Some express versions strip the param; if so, datasetKey is undefined
    // and Zod fails with "Required". Either way: 400.
    assert.equal(status, 400);
    assert.equal(body.status, 'error');
    assert.ok(Array.isArray(body.issues));
    assert.ok(body.issues.length > 0);
    assert.ok(body.issues[0].path.includes('datasetKey'));
  } finally {
    await close();
  }
});

test('validation: rejects invalid dataset key with structured issues', async () => {
  const app = express();
  app.use(express.json());
  app.get(
    '/dataset/:datasetKey',
    validate({ params: z.object({ datasetKey: DatasetKeySchema }) }),
    (_req, res) => res.json({ ok: true })
  );
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    const { status, body } = await getJson(`${url}/dataset/not-a-real-key`);
    assert.equal(status, 400);
    assert.equal(body.status, 'error');
    assert.ok(body.issues.some((i: any) => i.path === 'datasetKey'));
  } finally {
    await close();
  }
});

test('validation: rejects malformed astronaut id', async () => {
  const app = express();
  app.use(express.json());
  app.get(
    '/astronauts/:id',
    validate({ params: z.object({ id: AstronautIdSchema }) }),
    (_req, res) => res.json({ ok: true })
  );
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    const { status, body } = await getJson(`${url}/astronauts/foo`);
    assert.equal(status, 400);
    assert.ok(body.issues.some((i: any) => i.message.includes('ast_NNN')));

    const ok = await getJson(`${url}/astronauts/ast_007`);
    assert.equal(ok.status, 200);
  } finally {
    await close();
  }
});

test('validation: rejects non-integer limit, negative offset, and oversize limit', async () => {
  const app = express();
  app.use(express.json());
  app.get(
    '/list',
    validate({ query: PaginationQuerySchema }),
    (_req, res) => res.json({ ok: true })
  );
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    // Non-integer limit ("abc") -> Zod coerce fails -> 400
    let r = await getJson(`${url}/list?limit=abc`);
    assert.equal(r.status, 400);
    assert.ok(r.body.issues.some((i: any) => i.path.startsWith('limit')));

    // Negative offset
    r = await getJson(`${url}/list?offset=-5`);
    assert.equal(r.status, 400);

    // limit above max (100)
    r = await getJson(`${url}/list?limit=5000`);
    assert.equal(r.status, 400);

    // Defaults applied when omitted
    r = await getJson(`${url}/list`);
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('validation: rejects unknown astronaut status filter', async () => {
  const app = express();
  app.use(express.json());
  app.get(
    '/astronauts',
    validate({ query: AstronautListQuerySchema }),
    (_req, res) => res.json({ ok: true })
  );
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    const r = await getJson(`${url}/astronauts?status=Bananas`);
    assert.equal(r.status, 400);
    assert.ok(r.body.issues.some((i: any) => i.path === 'status'));
  } finally {
    await close();
  }
});

test('validation: rejects malformed `since` timestamp in telemetry query', async () => {
  const app = express();
  app.use(express.json());
  app.get(
    '/telemetry',
    validate({ query: TelemetryQuerySchema }),
    (_req, res) => res.json({ ok: true })
  );
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    const r = await getJson(`${url}/telemetry?since=not-a-date`);
    assert.equal(r.status, 400);
    assert.ok(r.body.issues.some((i: any) => i.path === 'since'));
  } finally {
    await close();
  }
});

test('validation: rejects malformed JSON body with 400', async () => {
  const BodySchema = z.object({ name: z.string(), age: z.number().int().min(0) });
  const app = express();
  app.use(express.json({ strict: true }));
  app.post('/echo', validate({ body: BodySchema }), (req, res) => res.json(req.body));
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    // Send malformed JSON by passing an invalid string
    const r = await postJson(`${url}/echo`, '{not json');
    assert.equal(r.status, 400);

    // Wrong types
    const wrong = await postJson(`${url}/echo`, { name: 123, age: 'old' });
    assert.equal(wrong.status, 400);
    assert.ok(Array.isArray(wrong.body.issues));
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 2. Invalid dataset shapes
// ---------------------------------------------------------------------------

test('dataset validation: rejects ISS dataset missing latitude', () => {
  assert.throws(
    () => DatasetLoader.validateISSData({ name: 'ISS', longitude: 0, altitude: 400, velocity: 27000, timestamp: 'now' }),
    /iss\.latitude/
  );
});

test('dataset validation: rejects ISS dataset with wrong type for altitude', () => {
  assert.throws(
    () => DatasetLoader.validateISSData({
      name: 'ISS', latitude: 0, longitude: 0, altitude: 'high', velocity: 27000, timestamp: 'now'
    }),
    /iss\.altitude/
  );
});

test('dataset validation: rejects astronauts dataset that is not an array', () => {
  assert.throws(() => DatasetLoader.validateAstronautData({}), /must be an array/);
});

test('dataset validation: rejects astronaut record with missing vitalSigns.heartRate', () => {
  assert.throws(
    () => DatasetLoader.validateAstronautData([
      {
        id: 'ast_001', name: 'X', role: 'r', missionSpecialty: 'm',
        healthScore: 90, status: 'Stable',
        vitalSigns: { oxygenSaturation: 98, cabinPressure: 101.3, temperature: 36.6 },
        lastUpdate: 'now'
      }
    ]),
    /vitalSigns\.heartRate/
  );
});

test('dataset validation: rejects rocket dataset with non-numeric healthScore', () => {
  assert.throws(
    () => DatasetLoader.validateRocketData({
      id: 'r', name: 'r', status: 'ok', healthScore: 'broken',
      currentStage: 's', lastCheck: 'c',
      systems: { thrust: 1, fuelPressure: 1, thermalManagement: 1, propulsionSystem: 1, avionicsHealth: 1 }
    }),
    /rocket\.healthScore/
  );
});

test('dataset validation: rejects NASA dataset with missing solarActivity.flareIndex', () => {
  assert.throws(
    () => DatasetLoader.validateNASAData({
      apod: { title: 't', explanation: 'e', url: 'u', hdurl: 'h', date: 'd' },
      asteroids: { hazardousCount: 0, closestAsteroid: 'a', closestDistance: 0, trackedToday: 0, summary: 's' },
      solarActivity: { geomagneticStormLevel: 'G1' }
    }),
    /solarActivity\.flareIndex/
  );
});

test('dataset validation: rejects mission dataset with non-array objectives', () => {
  assert.throws(
    () => DatasetLoader.validateMissionData({
      missionId: 'm', missionName: 'n', phase: 'p', duration: 'd', startDate: 's',
      objectives: 'not-an-array', crewManifest: []
    }),
    /objectives/
  );
});

// ---------------------------------------------------------------------------
// 3. Service failures bubble as structured 500s
// ---------------------------------------------------------------------------

test('error handler: routes unknown errors to a structured 500', async () => {
  const app = express();
  app.use(express.json());
  app.get('/boom', (_req, _res, next) => next(new Error('kaboom')));
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    const r = await getJson(`${url}/boom`);
    assert.equal(r.status, 500);
    assert.equal(r.body.status, 'error');
    assert.equal(r.body.message, 'Internal server error');
    assert.equal(r.body.error, undefined);
    assert.ok(!JSON.stringify(r.body).includes('kaboom'));
  } finally {
    await close();
  }
});

test('error handler: preserves HttpError status and message', async () => {
  const app = express();
  app.use(express.json());
  app.get('/notfound', (_req, _res, next) => next(new HttpError(404, 'missing thing')));
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    const r = await getJson(`${url}/notfound`);
    assert.equal(r.status, 404);
    assert.equal(r.body.status, 'error');
    assert.equal(r.body.message, 'missing thing');
    // No `issues` array for non-Zod errors
    assert.equal(r.body.issues, undefined);
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 4. External API unavailable -> 502
// ---------------------------------------------------------------------------

test('proxy: returns 502 Bad Gateway when external backend is unreachable', async () => {
  const { forwardRequest } = await import('../src/services/proxyService.js');
  const app = express();
  app.get('/external', (req, res) => forwardRequest(req, res, 'http://127.0.0.1:1'));

  const { url, close } = await startServer(app);
  try {
    const r = await getJson(`${url}/external`);
    assert.equal(r.status, 502);
    assert.equal(r.body.status, 'error');
    assert.equal(r.body.message, 'Bad gateway');
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 5. End-to-end: real route under dataset/file-system failure
// ---------------------------------------------------------------------------

test('end-to-end: 404 path returns structured payload via HttpError', async () => {
  // Reuse the real datasetRoutes module to ensure 404 uses HttpError
  const datasetRoutes = (await import('../src/routes/datasetRoutes.js')).default;
  const app = express();
  app.use(express.json());
  app.use(requestLogger);
  app.use('/api', datasetRoutes);
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    // Missing astronaut should yield a structured 404
    const r = await getJson(`${url}/api/dataset/astronauts/ast_999`);
    assert.equal(r.status, 404);
    assert.equal(r.body.status, 'error');
    assert.ok(r.body.message.includes('ast_999'));

    // Invalid id format -> 400 with Zod issues
    const bad = await getJson(`${url}/api/dataset/astronauts/not-an-id`);
    assert.equal(bad.status, 400);
    assert.ok(Array.isArray(bad.body.issues));
  } finally {
    await close();
  }
});

test('end-to-end: pagination caps payload and reports metadata', async () => {
  const datasetRoutes = (await import('../src/routes/datasetRoutes.js')).default;
  const app = express();
  app.use(express.json());
  app.use('/api', datasetRoutes);
  app.use(errorHandler);

  const { url, close } = await startServer(app);
  try {
    const r = await getJson(`${url}/api/dataset?limit=2&offset=0`);
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'success');
    assert.ok(r.body.pagination);
    assert.equal(r.body.pagination.limit, 2);
    assert.equal(r.body.pagination.offset, 0);
    assert.ok(r.body.pagination.hasMore);

    const r2 = await getJson(`${url}/api/dataset?limit=2&offset=99`);
    assert.equal(r2.status, 200);
    assert.equal(r2.body.pagination.returned, 0);
    assert.equal(r2.body.pagination.hasMore, false);

    // Astronaut list pagination + status filter
    const astro = await getJson(`${url}/api/dataset/astronauts?limit=1&offset=0&status=Stable`);
    assert.equal(astro.status, 200);
    assert.equal(astro.body.pagination.total >= 1, true);
    assert.equal(astro.body.pagination.returned, 1);

    // Astronaut list pagination rejecting unknown status
    const bad = await getJson(`${url}/api/dataset/astronauts?status=Bananas`);
    assert.equal(bad.status, 400);
  } finally {
    await close();
  }
});

// Suppress unused warnings: keep the Server import alive so future tests can
// use it without re-importing.
void (null as unknown as Server);


test('production app rejects malformed inputs and logs correlated errors', async (t) => {
  const { app } = await import('../src/app.js');
  const { logger } = await import('../src/middleware/logger.js');
  const requestLogs: any[] = [], errorLogs: any[] = [];
  t.mock.method(logger, 'info', (_message: string, meta: any) => { requestLogs.push(meta); return logger; });
  t.mock.method(logger, 'error', (_message: string, meta: any) => { errorLogs.push(meta); return logger; });
  const { url, close } = await startServer(app);
  try {
    for (const query of ['limit=1&limit=2', 'limit[]=1', 'limit[x]=1', 'offset=', 'limit=1e1', 'limit=0x10', 'offset=9007199254740992', 'unknown=1']) {
      assert.equal((await getJson(`${url}/api/dataset?${query}`)).status, 400, query);
    }
    const response = await fetch(`${url}/api/dataset/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
    assert.equal(response.status, 400);
    const id = response.headers.get('x-request-id');
    assert.ok(id);
    await response.text();
    assert.ok(errorLogs.some(log => log.requestId === id && log.status === 400));
    assert.ok(requestLogs.some(log => log.requestId === id && log.status === 400 && typeof log.durationMs === 'number'));
    assert.equal((await postJson(`${url}/api/dataset/refresh`, { unexpected: true })).status, 400);
    const huge = await postJson(`${url}/api/dataset/refresh`, { value: 'x'.repeat(110000) });
    assert.equal(huge.status, 413);
    const missing = await getJson(`${url}/api/missing`);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.status, 'error');
  } finally { await close(); }
});

test('real dataset route handles storage and invalid file failures without leaking details', async (t) => {
  const { app } = await import('../src/app.js');
  const { url, close } = await startServer(app);
  try {
    for (const error of [Object.assign(new Error('private storage path'), { code: 'EACCES' }), new Error('disk offline')]) {
      const mock = t.mock.method(DatasetLoader.storage, 'stat', async () => { throw error; });
      const result = await getJson(`${url}/api/dataset/iss`);
      assert.deepEqual(result, { status: 500, body: { status: 'error', message: 'Internal server error' } });
      mock.mock.restore();
    }
    for (const invalid of ['{bad json', '{"name":"ISS"}']) {
      DatasetLoader.clearCache();
      const mock = t.mock.method(DatasetLoader.storage, 'readFile', async () => invalid);
      const result = await getJson(`${url}/api/dataset/iss`);
      assert.equal(result.status, 500);
      assert.equal(result.body.error, undefined);
      mock.mock.restore();
    }
    assert.equal((await getJson(`${url}/api/dataset/iss`)).status, 200);
  } finally { await close(); }
});

test('real telemetry route handles service errors and simulated database exceptions', async (t) => {
  const { app } = await import('../src/app.js');
  const { DatasetService } = await import('../src/services/datasetService.js');
  const { url, close } = await startServer(app);
  try {
    // No database is wired into this project. Inject representative database
    // exceptions at the data-service boundary; this is not a live outage test.
    for (const error of [new Error('processing failed'), Object.assign(new Error('database unavailable: secret connection string'), { name: 'PrismaClientInitializationError', errorCode: 'P1001' })]) {
      const mock = t.mock.method(DatasetService, 'getISSData', async () => { throw error; });
      const result = await getJson(`${url}/api/telemetry`);
      assert.deepEqual(result, { status: 500, body: { status: 'error', message: 'Internal server error' } });
      mock.mock.restore();
    }
    assert.equal((await getJson(`${url}/api/telemetry`)).status, 200);
  } finally { await close(); }
});

test('pagination bounds bundle collections, mission lists, alerts and telemetry', async () => {
  const { app } = await import('../src/app.js');
  const { url, close } = await startServer(app);
  try {
    const bundle = await getJson(`${url}/api/dataset?limit=3`);
    assert.equal(bundle.body.data.astronauts.length, 3);
    const mission = await getJson(`${url}/api/dataset/mission?limit=1&offset=1`);
    assert.equal(mission.body.data.objectives.length, 1);
    assert.equal(mission.body.collections.objectives.offset, 1);
    const alerts = await getJson(`${url}/api/alerts?limit=2`);
    assert.equal(alerts.body.events.length, 2);
    assert.equal(alerts.body.collections.events.hasMore, true);
    const telemetry = await getJson(`${url}/api/telemetry?limit=1&offset=999`);
    assert.equal(telemetry.body.history.length, 0);
    assert.equal(telemetry.body.pagination.hasMore, false);
  } finally { await close(); }
});

test('production proxy handles timeouts and upstream 500 without exposing upstream bodies', async () => {
  const { forwardRequest } = await import('../src/services/proxyService.js');
  const upstreamApp = express();
  upstreamApp.get('/fail', (_req, res) => res.status(500).send('private upstream exception'));
  upstreamApp.get('/slow', (_req, res) => { const timer = setTimeout(() => res.end('late'), 500); res.on('close', () => clearTimeout(timer)); });
  const upstream = await startServer(upstreamApp);
  const app = express();
  app.use((req, res) => forwardRequest(req, res, upstream.url, fetch, 50));
  const proxy = await startServer(app);
  try {
    for (const path of ['/fail', '/slow']) {
      const result = await getJson(proxy.url + path);
      assert.deepEqual(result, { status: 502, body: { status: 'error', message: 'Bad gateway' } });
    }
  } finally { await proxy.close(); await upstream.close(); }
});


test('large astronaut datasets are bounded by default and maximum page size', async (t) => {
  const { app } = await import('../src/app.js');
  const { DatasetService } = await import('../src/services/datasetService.js');
  const original = await DatasetService.getAstronautData();
  t.mock.method(DatasetService, 'getAstronautData', async () => Array.from({ length: 250 }, (_, i) => ({ ...original[0], id: `ast_${String(i).padStart(3, '0')}` })));
  const { url, close } = await startServer(app);
  try {
    const first = await getJson(`${url}/api/dataset/astronauts`);
    assert.equal(first.body.data.length, 20);
    assert.equal(first.body.pagination.total, 250);
    const last = await getJson(`${url}/api/dataset/astronauts?limit=100&offset=200`);
    assert.equal(last.body.data.length, 50);
    assert.equal(last.body.pagination.hasMore, false);
    assert.equal(last.body.data[0].id, 'ast_200');
    assert.equal((await getJson(`${url}/api/dataset/astronauts?limit=101`)).status, 400);
  } finally { await close(); }
});
