// Mission Operations Page (Dashboard)
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Mission, MissionAlert, StationInfo } from '../types/mission';
import { getMission, getISS, getAstronauts, getSpaceWeather } from '../services/api';
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
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Mock alerts
  const mockAlerts: MissionAlert[] = [
    {
      id: '1',
      title: 'Telemetry Stream Active',
      description: 'All telemetry channels broadcasting nominal data',
      severity: 'Info',
      timestamp: new Date().toISOString(),
      source: 'Telemetry System',
      affectedSubsystem: 'Communications',
      status: 'Active',
    },
  ];

  return (
    <div className=\"space-y-8\">
      {/* Header */}
      <div className=\"flex items-center justify-between gap-4\">
        <div>
          <h1 className=\"text-4xl font-bold text-slate-100\">Mission Operations Control</h1>
          <p className=\"mt-2 text-slate-400\">Real-time mission monitoring and telemetry ingestion</p>
        </div>
        <div className=\"flex flex-col items-end gap-2\">
          <div className=\"flex items-center gap-2\">
            {isLoading && <LoadingSpinner size=\"sm\" />}
            <DataFreshnessIndicator lastUpdated={lastUpdated} />
          </div>
          <Button variant=\"primary\" size=\"sm\" onClick={loadDashboardData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className=\"grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4\">
        <Link to=\"/missions\">
          <Button variant=\"secondary\" className=\"w-full\">
            View All Missions
          </Button>
        </Link>
        <Button variant=\"secondary\" className=\"w-full\">
          Export Telemetry
        </Button>
        <Button variant=\"secondary\" className=\"w-full\">
          Mission Timeline
        </Button>
        <Button variant=\"secondary\" className=\"w-full\">
          System Health
        </Button>
      </div>

      {/* Active Mission Summary */}
      {activeMission && (
        <div className=\"space-y-4\">
          <h2 className=\"text-2xl font-bold text-slate-100\">Active Mission</h2>
          <div className=\"grid gap-6 lg:grid-cols-3\">
            <div className=\"lg:col-span-2\">
              <MissionCard mission={activeMission} />
            </div>
            <OperationalStatus mission={activeMission} />
          </div>
        </div>
      )}

      {/* KPI Dashboard */}
      {activeMission?.kpis && activeMission.kpis.length > 0 && (
        <div className=\"space-y-4\">
          <h2 className=\"text-2xl font-bold text-slate-100\">Key Metrics</h2>
          <div className=\"grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4\">
            {activeMission.kpis.slice(0, 4).map((kpi) => (
              <MissionKpiCard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </div>
      )}

      {/* Station Status */}
      {station && (
        <div className=\"space-y-4\">
          <h2 className=\"text-2xl font-bold text-slate-100\">Station Position & Telemetry</h2>
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
      <div className=\"space-y-4\">
        <h2 className=\"text-2xl font-bold text-slate-100\">System Alerts</h2>
        <MissionAlertList alerts={mockAlerts} />
      </div>

      {/* Footer Info */}
      <div className=\"rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400\">
        <p>
          Mission operations dashboard provides real-time telemetry ingestion and historical trend tracking.
          Data updates automatically every 30 seconds.
        </p>
      </div>
    </div>
  );
}

