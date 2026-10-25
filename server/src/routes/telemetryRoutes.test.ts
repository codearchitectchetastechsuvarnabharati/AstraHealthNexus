import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import telemetryRoutes from './telemetryRoutes.js';

async function startTestServer() {
  const app = express();
  app.use(telemetryRoutes);

  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        throw new Error('Test server address unavailable');
      }

      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          })
      });
    });
  });
}

describe('telemetry API critical coverage', () => {
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('returns a live telemetry snapshot', async () => {
    server = await startTestServer();

    const response = await fetch(`${server.url}/telemetry/live`);
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.timestamp).toBeTruthy();
    expect(body.orbit).toBeTruthy();
    expect(body.weather).toBeTruthy();
    expect(body.missionStatus).toBeTruthy();
    expect(body.lastUpdated).toBeTruthy();
  });

  it('returns telemetry history with the current snapshot', async () => {
    server = await startTestServer();

    const response = await fetch(`${server.url}/telemetry`);
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.snapshot).toBeDefined();
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.history.length).toBeGreaterThan(0);
    expect(body.history[body.history.length - 1].timestamp).toBe(
      body.snapshot.timestamp
    );
  });
});
