// codeauthor chetas karnam
import { Router } from 'express';
import { collectTelemetrySnapshot, getTelemetryHistory } from '../services/ingestionService.js';

const router = Router();

// map range -> number of history points to return (history is a ring buffer of recent snapshots)
const RANGE_POINTS_MAP: Record<string, number> = {
  last15m: 3,
  last1h: 6,
  last6h: 12,
  last24h: 20,
  last7d: 9999,
  custom: 9999
};

function computeStats(values: number[]) {
  const clean = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (clean.length === 0) return { minValue: 0, maxValue: 0, average: 0 };
  const minValue = Math.min(...clean);
  const maxValue = Math.max(...clean);
  const average = clean.reduce((s, v) => s + v, 0) / clean.length;
  return { minValue, maxValue, average };
}

function metricStatusFromValue(metricId: string, val: number) {
  // Simple heuristics; adjust per metric if needed
  if (metricId === 'space_weather') {
    // larger Kp is worse
    if (val >= 7) return 'Critical';
    if (val >= 5) return 'Warning';
    return 'Nominal';
  }
  if (val >= 85) return 'Nominal';
  if (val >= 70) return 'Warning';
  return 'Critical';
}

// Original snapshot + history endpoint (kept for backward compatibility)
router.get('/telemetry', async (_req, res) => {
  try {
    const snapshot = await collectTelemetrySnapshot();
    res.json({ status: 'success', data: { snapshot, history: getTelemetryHistory() } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to collect telemetry', error: String(error) });
  }
});

// Live snapshot
router.get('/telemetry/live', async (_req, res) => {
  try {
    const snapshot = await collectTelemetrySnapshot();
    res.json({ status: 'success', data: snapshot });
  } catch (error) {
    res.status(500).json({ message: 'Failed to collect live telemetry', error: String(error) });
  }
});

// Telemetry series endpoint that returns TelemetrySeries[]
router.get('/telemetry/series', async (req, res) => {
  try {
    // parse metricIds query param (supports repeated metricIds or comma-separated)
    const metricIdsRaw = req.query.metricIds;
    let metricIds: string[] = [];
    if (Array.isArray(metricIdsRaw)) {
      metricIds = metricIdsRaw.map(String);
    } else if (metricIdsRaw) {
      metricIds = String(metricIdsRaw).split(',').map((s) => s.trim()).filter(Boolean);
    }

    const range = String(req.query.range ?? 'last24h');
    const points = RANGE_POINTS_MAP[range] ?? 20;

    const snapshot = await collectTelemetrySnapshot();
    const history = getTelemetryHistory();

    const slicedHistory = points >= history.length ? history.slice() : history.slice(Math.max(0, history.length - points));

    // helper to safely extract numeric values from a telemetry record
    const extract = (rec: any, key: string) => {
      try {
        switch (key) {
          case 'crew_health':
            return Number(rec.crewAndVehicleHealth?.astronautHealthScore ?? 0);
          case 'vehicle_health':
            return Number(rec.crewAndVehicleHealth?.rocketHealthScore ?? 0);
          case 'space_weather':
            return Number(rec.spaceWeatherKPIndex ?? rec.spaceWeather?.kpIndex ?? 0);
          case 'orbital_lock': {
            const t = (rec.telemetry ?? []).find((t: any) => String(t.label).toLowerCase().includes('orbital'));
            return Number(t?.value ?? 0);
          }
          case 'feed_sync': {
            const t = (rec.telemetry ?? []).find((t: any) => String(t.label).toLowerCase().includes('feed'));
            return Number(t?.value ?? 0);
          }
          case 'heart_rate':
            return Number(rec.crewAndVehicleHealth?.astronautVitalSigns?.heartRate ?? rec.crewAndVehicleHealth?.astronautVitalSigns?.heartRate ?? 0);
          case 'oxygen_saturation':
            return Number(rec.crewAndVehicleHealth?.astronautVitalSigns?.oxygen ?? rec.crewAndVehicleHealth?.astronautVitalSigns?.oxygenSaturation ?? 0);
          case 'cabin_pressure':
            return Number(rec.crewAndVehicleHealth?.astronautVitalSigns?.cabinPressure ?? 0);
          case 'temperature':
            return Number(rec.crewAndVehicleHealth?.astronautVitalSigns?.temperature ?? 0);
          case 'thrust':
            return Number(rec.crewAndVehicleHealth?.rocketSystems?.thrust ?? 0);
          case 'fuel_pressure':
            return Number(rec.crewAndVehicleHealth?.rocketSystems?.fuelPressure ?? 0);
          default:
            return 0;
        }
      } catch (e) {
        return 0;
      }
    };

    // list of candidate metrics; include both aggregated KPIs and more granular vitals
    const candidates = [
      { id: 'crew_health', name: 'Crew Health', unit: '%' },
      { id: 'vehicle_health', name: 'Vehicle Health', unit: '%' },
      { id: 'space_weather', name: 'Space Weather (Kp)', unit: 'Kp' },
      { id: 'orbital_lock', name: 'Orbital Lock', unit: '%' },
      { id: 'feed_sync', name: 'Feed Sync', unit: '%' },
      { id: 'heart_rate', name: 'Heart Rate', unit: 'bpm' },
      { id: 'oxygen_saturation', name: 'Oxygen Saturation', unit: '%' },
      { id: 'cabin_pressure', name: 'Cabin Pressure', unit: 'kPa' },
      { id: 'temperature', name: 'Temperature', unit: '°C' },
      { id: 'thrust', name: 'Engine Thrust', unit: '%' },
      { id: 'fuel_pressure', name: 'Fuel Pressure', unit: 'psi' }
    ];

    const buildSeriesFor = (metricId: string, name: string, unit: string) => {
      const dataPoints = slicedHistory.map((h: any) => ({ timestamp: h.timestamp, value: Number(extract(h, metricId) ?? 0) }));
      const { minValue, maxValue, average } = computeStats(dataPoints.map((d) => d.value));
      // prefer snapshot-provided current values if available
      const snapshotValue = Number(extract(snapshot as any, metricId) ?? 0);
      const currentValue = snapshotValue || (dataPoints.length ? dataPoints[dataPoints.length - 1].value : 0);

      return {
        metric: {
          id: metricId,
          name,
          unit,
          currentValue,
          minValue,
          maxValue,
          average,
          status: metricStatusFromValue(metricId, currentValue)
        },
        dataPoints
      };
    };

    let series = candidates.map((c) => buildSeriesFor(c.id, c.name, c.unit));

    // if metricIds filter provided, filter the series accordingly
    if (metricIds.length > 0) {
      const lookup = new Set(metricIds.map((m) => m.toLowerCase()));
      series = series.filter((s) => lookup.has(s.metric.id.toLowerCase()));
    }

    // ensure timestamps are ISO and series data is sorted
    series.forEach((s) => {
      s.dataPoints.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      s.dataPoints = s.dataPoints.map((d: any) => ({ timestamp: new Date(d.timestamp).toISOString(), value: Number(d.value) }));
    });

    res.json({ status: 'success', data: series });
  } catch (error) {
    res.status(500).json({ message: 'Failed to construct telemetry series', error: String(error) });
  }
});

export default router;
