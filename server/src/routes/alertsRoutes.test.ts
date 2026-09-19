import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import alertsRoutes from './alertsRoutes.js';

async function startTestServer() {
  const app = express();
  app.use(alertsRoutes);

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

describe('alerts API critical coverage', () => {
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('returns a valid generated alert snapshot', async () => {
    server = await startTestServer();

    const response = await fetch(`${server.url}/alerts`);
    expect(response.status).toBe(200);

    const body = await response.json();
    const allowed = ['info', 'warning', 'critical'];

    expect(body.summary).toBeTruthy();
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBeGreaterThan(0);
    expect(allowed).toContain(body.severity);

    for (const event of body.events) {
      expect(event.message).toBeTruthy();
      expect(allowed).toContain(event.severity);
    }
  });
});
