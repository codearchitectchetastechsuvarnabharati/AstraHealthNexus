import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import alertsRoutes from './alertsRoutes.js';
import {
  recordAlertHistory,
  resetAlertHistoryForTests
} from '../services/alertHistoryService.js';

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

describe('alerts history API', () => {
  afterEach(() => {
    resetAlertHistoryForTests();
  });

  it('returns filtered history through the API', async () => {
    await recordAlertHistory([
      {
        severity: 'info',
        message: 'Mission phase active',
        source: 'dashboard',
        createdAt: new Date('2026-03-01T00:00:00.000Z')
      },
      {
        severity: 'warning',
        message: 'Space weather warning',
        source: 'dashboard',
        createdAt: new Date('2026-03-02T00:00:00.000Z')
      }
    ]);

    const server = await startTestServer();

    try {
      const response = await fetch(
        `${server.url}/alerts/history?severity=warning&limit=1&offset=0`
      );

      expect(response.status).toBe(200);

      const body = await response.json();

      expect(body.total).toBe(1);
      expect(body.limit).toBe(1);
      expect(body.offset).toBe(0);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].severity).toBe('warning');
      expect(body.items[0].message).toBe('Space weather warning');
    } finally {
      await server.close();
    }
  });

  it('rejects invalid filter values', async () => {
    const server = await startTestServer();

    try {
      const response = await fetch(`${server.url}/alerts/history?limit=101`);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.message).toMatch(/limit/);
    } finally {
      await server.close();
    }
  });
});
