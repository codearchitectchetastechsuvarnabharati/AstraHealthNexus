import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { errorHandler } from './errorHandler.js';

async function startTestServer() {
  const app = express();

  app.get('/error', (_req, _res) => {
    throw new Error('test failure');
  });

  app.use(errorHandler);

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

describe('errorHandler critical coverage', () => {
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('returns the standard 500 error payload', async () => {
    server = await startTestServer();

    const response = await fetch(`${server.url}/error`);
    expect(response.status).toBe(500);

    const body = await response.json();

    expect(body).toEqual({
      message: 'Internal server error',
      error: 'test failure'
    });
  });
});
