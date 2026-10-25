import { afterEach, describe, expect, it } from 'vitest';
import {
  getAlertHistory,
  recordAlertHistory,
  resetAlertHistoryForTests
} from './alertHistoryService.js';

describe('alertHistoryService', () => {
  afterEach(() => {
    resetAlertHistoryForTests();
  });

  it('stores and retrieves history newest first', async () => {
    const older = new Date('2026-01-01T00:00:00.000Z');
    const newer = new Date('2026-01-02T00:00:00.000Z');

    await recordAlertHistory([
      { severity: 'info', message: 'Mission phase active', createdAt: older },
      { severity: 'warning', message: 'Space weather warning', createdAt: newer }
    ]);

    const result = await getAlertHistory();

    expect(result.total).toBe(2);
    expect(result.items[0].message).toBe('Space weather warning');
    expect(result.items[1].message).toBe('Mission phase active');
    expect(result.items[0].isAcknowledged).toBe(false);
  });

  it('filters by severity, source, search text and date range', async () => {
    await recordAlertHistory([
      {
        severity: 'warning',
        message: 'Space weather storm detected',
        source: 'telemetry',
        createdAt: new Date('2026-02-01T00:00:00.000Z')
      },
      {
        severity: 'critical',
        message: 'Emergency system failure detected',
        source: 'mission',
        createdAt: new Date('2026-02-02T00:00:00.000Z')
      },
      {
        severity: 'warning',
        message: 'Crew health needs attention',
        source: 'crew',
        createdAt: new Date('2026-02-03T00:00:00.000Z')
      }
    ]);

    const result = await getAlertHistory({
      severity: 'warning',
      source: 'telemetry',
      search: 'STORM',
      from: new Date('2026-02-01T00:00:00.000Z'),
      to: new Date('2026-02-02T23:59:59.999Z')
    });

    expect(result.total).toBe(1);
    expect(result.items[0].message).toBe('Space weather storm detected');
  });

  it('applies bounded pagination', async () => {
    await recordAlertHistory([
      { severity: 'info', message: 'One' },
      { severity: 'info', message: 'Two' },
      { severity: 'info', message: 'Three' }
    ]);

    const result = await getAlertHistory({ limit: 2, offset: 1 });

    expect(result.total).toBe(3);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(1);
    expect(result.items).toHaveLength(2);
  });
});
