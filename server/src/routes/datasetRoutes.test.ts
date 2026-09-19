import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import datasetRoutes from './datasetRoutes.js';

async function startTestServer() {
  const app = express();
  app.use(datasetRoutes);

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

describe('dataset API critical coverage', () => {
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('returns the supported dataset keys', async () => {
    server = await startTestServer();

    const response = await fetch(`${server.url}/dataset/keys`);
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.status).toBe('success');
    expect(body.data).toEqual(
      expect.arrayContaining([
        'iss',
        'spaceWeather',
        'astronauts',
        'rocket',
        'nasa',
        'mission'
      ])
    );
  });

  it('returns a mission dataset through the API', async () => {
    server = await startTestServer();

    const response = await fetch(`${server.url}/dataset/mission`);
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.status).toBe('success');
    expect(body.data.missionId).toBeTruthy();
    expect(body.data.missionName).toBeTruthy();
  });

  it('returns a structured 404 for an unsupported dataset', async () => {
    server = await startTestServer();

    const response = await fetch(`${server.url}/dataset/not-a-real-dataset`);
    expect(response.status).toBe(404);

    const body = await response.json();

    expect(body.status).toBe('error');
    expect(body.code).toBe('DATASET_NOT_FOUND');
    expect(body.data).toBeNull();
  });
});
