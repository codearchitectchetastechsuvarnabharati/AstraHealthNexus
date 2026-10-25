// codeauthor chetas karnam
//
// SCRUMBOARD-23:
// Centralizes alert severity classification and keeps the severity levels
// configurable without changing the dashboard payload shape.
//
// Optional environment variables:
// ALERT_SEVERITY_LEVELS=info,warning,critical
// ALERT_DEFAULT_SEVERITY=info
//
// The first configured level is the default/lowest level, the second is
// the warning-level target, and the final level is the highest/critical target.

export type AlertSeverity = string;

const DEFAULT_ALERT_SEVERITIES = ['info', 'warning', 'critical'];

function normalizeSeverity(value: string): string {
  return value.trim().toLowerCase();
}

export function getConfiguredAlertSeverities(): string[] {
  const configured = (process.env.ALERT_SEVERITY_LEVELS ?? '')
    .split(',')
    .map(normalizeSeverity)
    .filter(Boolean);

  const unique = [...new Set(configured)];

  return unique.length >= 2 ? unique : [...DEFAULT_ALERT_SEVERITIES];
}

export function getDefaultAlertSeverity(): string {
  const levels = getConfiguredAlertSeverities();
  const configuredDefault = normalizeSeverity(process.env.ALERT_DEFAULT_SEVERITY ?? '');

  return levels.includes(configuredDefault) ? configuredDefault : levels[0];
}

function getWarningSeverity(levels: string[]): string {
  return levels[Math.min(1, levels.length - 1)];
}

function getCriticalSeverity(levels: string[]): string {
  return levels[levels.length - 1];
}

function parseMetric(message: string, pattern: RegExp): number | null {
  const match = message.match(pattern);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);

  return Number.isFinite(value) ? value : null;
}

export function getAlertSeverity(message: string): AlertSeverity {
  const levels = getConfiguredAlertSeverities();
  const warning = getWarningSeverity(levels);
  const critical = getCriticalSeverity(levels);
  const normalized = message.toLowerCase();

  const criticalKeywords = [
    'emergency',
    'critical',
    'system failure',
    'system failed',
    'failure detected',
    'failed',
    'dangerous condition'
  ];

  if (criticalKeywords.some((keyword) => normalized.includes(keyword))) {
    return critical;
  }

  const kpIndex = parseMetric(message, /\bkp\s*=\s*(\d+(?:\.\d+)?)\b/i);

  if (kpIndex !== null) {
    if (kpIndex >= 7) {
      return critical;
    }

    if (kpIndex >= 5) {
      return warning;
    }
  }

  const healthScore = parseMetric(
    message,
    /\b(?:crew health|rocket readiness)\s*:\s*(\d+(?:\.\d+)?)%/i
  );

  if (healthScore !== null) {
    if (healthScore < 70) {
      return critical;
    }

    if (healthScore < 84) {
      return warning;
    }
  }

  const hazardousAsteroids = parseMetric(
    message,
    /\b(\d+)\s+potentially hazardous asteroids?\b/i
  );

  if (hazardousAsteroids !== null && hazardousAsteroids > 0) {
    return warning;
  }

  const warningKeywords = [
    'warning',
    'storm',
    'anomaly',
    'attention',
    'elevated',
    'degraded',
    'hazard'
  ];

  if (warningKeywords.some((keyword) => normalized.includes(keyword))) {
    return warning;
  }

  return getDefaultAlertSeverity();
}

export function getHighestAlertSeverity(
  severities: AlertSeverity[]
): AlertSeverity {
  const levels = getConfiguredAlertSeverities();
  const ranking = new Map(levels.map((level, index) => [level, index]));
  const fallback = getDefaultAlertSeverity();

  return severities.reduce((highest, current) => {
    const highestRank = ranking.get(highest) ?? ranking.get(fallback) ?? 0;
    const currentRank = ranking.get(current) ?? ranking.get(fallback) ?? 0;

    return currentRank > highestRank ? current : highest;
  }, fallback);
}
