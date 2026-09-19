import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import dashboardRoutes from './dashboardRoutes.js';

async function startTestServer() {
  const app = express();
  app.use(dashboardRoutes);

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

describe('dashboard API critical coverage', () => {
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('returns a complete dashboard snapshot', async () => {
    server = await startTestServer();

    const response = await fetch(`${server.url}/dashboard`);
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.missionStatus).toBeTruthy();
    expect(body.orbit).toBeTruthy();
    expect(body.weather).toBeTruthy();
    expect(body.alerts).toHaveLength(7);
    expect(body.telemetry).toHaveLength(5);
    expect(body.lastUpdated).toBeTruthy();
    expect(body.crewAndVehicleHealth).toBeDefined();
  });
});
