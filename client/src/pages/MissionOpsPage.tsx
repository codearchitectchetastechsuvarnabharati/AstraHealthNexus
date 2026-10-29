// Mission Operations Page (Dashboard)
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Mission, MissionAlert, StationInfo } from '../types/mission';
import { getMission, getISS, getAlerts } from '../services/api';
import { MissionCard } from '../components/MissionCard';
import { OperationalStatus } from '../components/OperationalStatus';
import { MissionKpiCard } from '../components/MissionKpiCard';
import { StationStatus } from '../components/StationStatus';
import { TelemetryPanelView } from '../components/TelemetryPanelView';
import { MissionAlertList } from '../components/MissionAlertList';
import { DataFreshnessIndicator } from '../components/DataFreshnessIndicator';
import { LoadingSpinner } from '../components/Loading';
import { Button } from '../components/Button';

export function MissionOpsPage() {
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [station, setStation] = useState<StationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  useEffect(() => {
    loadDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [missionData, issData] = await Promise.all([getMission(), getISS()]);

      setActiveMission(missionData);
      setStation({
        name: issData.name || 'International Space Station',
        latitude: issData.latitude || 0,
        longitude: issData.longitude || 0,
        altitude: issData.altitude || 0,
        velocity: issData.velocity || 0,
        lastUpdated: new Date().toISOString(),
        status: 'Operational',
      });
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setLoadError((err as Error).message || 'Failed to load mission operations data');
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const exportTelemetry = () => {
    if (!activeMission) return;
    const rows = activeMission.kpis.map((kpi) => [kpi.label, kpi.value, kpi.unit, kpi.status, kpi.timestamp]);
    const csv = [['Metric', 'Value', 'Unit', 'Status', 'Timestamp'], ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeMission.id}-telemetry.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const [alerts, setAlerts] = useState<MissionAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadAlerts() {
      setAlertsLoading(true);
      setAlertsError(null);
      try {
        const data = await getAlerts();
        if (!mounted) return;
        setAlerts(data);
      } catch (err) {
        if (!mounted) return;
        setAlertsError((err as Error).message || 'Failed to load alerts');
      } finally {
        if (mounted) setAlertsLoading(false);
      }
    }
    loadAlerts();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-100">Mission Operations Control</h1>
          <p className="mt-2 text-slate-400">Real-time mission monitoring and telemetry ingestion</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {isLoading && <LoadingSpinner size="sm" />}
            <DataFreshnessIndicator lastUpdated={lastUpdated} />
          </div>
          <Button variant="primary" size="sm" onClick={loadDashboardData}>
            Refresh
          </Button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={loadDashboardData}>Retry</Button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/missions">
          <Button variant="secondary" className="w-full">
            View All Missions
          </Button>
        </Link>
        <Button variant="secondary" className="w-full" onClick={exportTelemetry} disabled={!activeMission}>
          Export Telemetry
        </Button>
        <Link to="/missions">
          <Button variant="secondary" className="w-full">
            Mission Timeline
          </Button>
        </Link>
        <Link to="/dashboard">
          <Button variant="secondary" className="w-full">
            System Health
          </Button>
        </Link>
      </div>

      {/* Active Mission Summary */}
      {activeMission && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-100">Active Mission</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MissionCard mission={activeMission} />
            </div>
            <OperationalStatus mission={activeMission} />
          </div>
        </div>
      )}

      {/* KPI Dashboard */}
      {activeMission?.kpis && activeMission.kpis.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-100">Key Metrics</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {activeMission.kpis.slice(0, 4).map((kpi) => (
              <MissionKpiCard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </div>
      )}

      {/* Station Status */}
      {station && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-100">Station Position & Telemetry</h2>
          <StationStatus station={station} />
          <div className="mt-4">
            <TelemetryPanelView
              metrics={
                (activeMission?.kpis || []).map((kpi) => ({
                  id: kpi.id,
                  name: kpi.label,
                  unit: kpi.unit,
                  currentValue: typeof kpi.value === 'number' ? kpi.value : Number(kpi.value) || 0,
                  minValue: undefined,
                  maxValue: undefined,
                  average: undefined,
                  status: kpi.status === 'Nominal' ? 'Nominal' : kpi.status === 'Warning' ? 'Warning' : 'Critical',
                }))
              }
            />
          </div>
        </div>
      )}

      {/* Alerts */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-100">System Alerts</h2>
        {alertsLoading ? (
          <div className="p-4"><p className="text-sm text-slate-400">Loading alerts...</p></div>
        ) : alertsError ? (
          <div className="p-4"><p className="text-sm text-yellow-400">{alertsError}</p></div>
        ) : (
          <MissionAlertList alerts={alerts} />
        )}
      </div>

      {/* Footer Info */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
        <p>
          Mission operations dashboard provides real-time telemetry ingestion and historical trend tracking.
          Data updates automatically every 30 seconds.
        </p>
      </div>
    </div>
  );
}


