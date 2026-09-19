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

  it('returns the generated alert snapshot with seven events', async () => {
    server = await startTestServer();

    const response = await fetch(`${server.url}/alerts`);
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.summary).toBe('Local dataset snapshot refreshed');
    expect(body.events).toHaveLength(7);
    expect(body.severity).toBe('info');

    for (const event of body.events) {
      expect(event.message).toBeTruthy();
      expect(event.severity).toBe('info');
    }
  });
});
