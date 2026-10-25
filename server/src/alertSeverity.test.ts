import {
  getAlertSeverity,
  getConfiguredAlertSeverities,
  getDefaultAlertSeverity,
  getHighestAlertSeverity
} from './alertSeverity.js';
import { afterEach, describe, expect, it } from 'vitest';

describe('alertSeverity', () => {
  const originalLevels = process.env.ALERT_SEVERITY_LEVELS;
  const originalDefault = process.env.ALERT_DEFAULT_SEVERITY;

  afterEach(() => {
    if (originalLevels === undefined) {
      delete process.env.ALERT_SEVERITY_LEVELS;
    } else {
      process.env.ALERT_SEVERITY_LEVELS = originalLevels;
    }

    if (originalDefault === undefined) {
      delete process.env.ALERT_DEFAULT_SEVERITY;
    } else {
      process.env.ALERT_DEFAULT_SEVERITY = originalDefault;
    }
  });

  it('uses the default severity levels', () => {
    delete process.env.ALERT_SEVERITY_LEVELS;
    delete process.env.ALERT_DEFAULT_SEVERITY;

    expect(getConfiguredAlertSeverities()).toEqual([
      'info',
      'warning',
      'critical'
    ]);
    expect(getDefaultAlertSeverity()).toBe('info');
    expect(getAlertSeverity('NASA APOD: Example')).toBe('info');
  });

  it('assigns warning to active hazard and moderate threshold conditions', () => {
    expect(
      getAlertSeverity(
        '3 potentially hazardous asteroids tracked today; closest is 2023 BL24.'
      )
    ).toBe('warning');

    expect(getAlertSeverity('Space weather warning detected')).toBe('warning');
    expect(getAlertSeverity('Space weather KPI: Kp=5, Solar flux=150')).toBe(
      'warning'
    );
    expect(getAlertSeverity('Crew health: 80% average across 4 crew')).toBe(
      'warning'
    );
  });

  it('assigns critical to severe conditions', () => {
    expect(getAlertSeverity('Emergency system failure detected')).toBe(
      'critical'
    );
    expect(getAlertSeverity('Space weather KPI: Kp=7, Solar flux=210')).toBe(
      'critical'
    );
    expect(getAlertSeverity('Crew health: 65% average across 4 crew')).toBe(
      'critical'
    );
    expect(getAlertSeverity('Rocket readiness: 60% (descent)')).toBe(
      'critical'
    );
  });

  it('supports configured severity levels and a configured default', () => {
    process.env.ALERT_SEVERITY_LEVELS = 'normal,warning,critical';
    process.env.ALERT_DEFAULT_SEVERITY = 'warning';

    expect(getConfiguredAlertSeverities()).toEqual([
      'normal',
      'warning',
      'critical'
    ]);
    expect(getDefaultAlertSeverity()).toBe('warning');
    expect(getAlertSeverity('ISS position: 10 deg N, 20 deg W')).toBe(
      'warning'
    );
    expect(
      getHighestAlertSeverity(['normal', 'warning', 'critical'])
    ).toBe('critical');
  });
});
