// Mission Detail Page
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Mission, MissionAlert, TelemetryMetric } from '../types/mission';
import { getMission, getISS, getAlerts } from '../services/api';
import { MissionHeader } from '../components/MissionHeader';
import { OperationalStatus } from '../components/OperationalStatus';
import { MissionObjectiveList } from '../components/MissionObjectiveList';
import { MissionCrew } from '../components/MissionCrew';
import { MissionKpiCard } from '../components/MissionKpiCard';
import { MissionAlertList } from '../components/MissionAlertList';
import { StationStatus } from '../components/StationStatus';
import { TelemetryPanelView } from '../components/TelemetryPanelView';
import { LoadingScreen } from '../components/Loading';
import { ErrorState } from '../components/ErrorState';
import { Button } from '../components/Button';
import type { StationInfo } from '../types/mission';

export function MissionDetailPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const [mission, setMission] = useState<Mission | null>(null);
  const [station, setStation] = useState<StationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<MissionAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadMissionData();
  }, [missionId]);

  useEffect(() => {
    let mounted = true;

    async function loadAlerts() {
      setAlertsLoading(true);
      setAlertsError(null);
      try {
        const data = await getAlerts();
        if (mounted) setAlerts(data);
      } catch (err) {
        if (mounted) setAlertsError((err as Error).message || 'Failed to load alerts');
      } finally {
        if (mounted) setAlertsLoading(false);
      }
    }

    loadAlerts();
    return () => { mounted = false; };
  }, [missionId]);

  const loadMissionData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [missionData, issData] = await Promise.all([getMission(missionId), getISS()]);

      setMission(missionData);
      setStation({
        name: issData.name || 'International Space Station',
        latitude: issData.latitude || 0,
        longitude: issData.longitude || 0,
        altitude: issData.altitude || 0,
        velocity: issData.velocity || 0,
        lastUpdated: new Date().toISOString(),
        status: 'Operational',
      });
    } catch (err) {
      setError((err as Error).message || 'Failed to load mission details');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading mission details..." />;
  }

  if (error || !mission) {
    return (
      <ErrorState
        message={error || 'Mission not found'}
        retry={loadMissionData}
        goBack={() => navigate('/missions')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <Link to="/missions">
        <Button variant="ghost" size="sm">â† Back to Missions</Button>
      </Link>

      {/* Mission Header */}
      <MissionHeader mission={mission} />

      {/* Operational Status */}
      <OperationalStatus mission={mission} />

      {/* KPIs Grid */}
      {mission.kpis.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-100">Key Performance Indicators</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mission.kpis.map((kpi) => (
              <MissionKpiCard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </div>
      )}

      {/* Objectives */}
      {mission.objectives.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-100">Mission Objectives</h2>
          <MissionObjectiveList objectives={mission.objectives} />
        </div>
      )}

      {/* Crew */}
      {mission.crew.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-100">Crew Manifest</h2>
          <MissionCrew crew={mission.crew} />
        </div>
      )}

      {/* Station Status */}
      {station && (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-100">Station Status</h2>
          <StationStatus station={station} />
          <div className="mt-4">
            <TelemetryPanelView
              metrics={
                (mission?.kpis || []).map((kpi) => ({
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
      <div className="space-y-3">
        <h2 className="text-2xl font-bold text-slate-100">Recent Alerts</h2>
        {alertsLoading ? (
          <p className="text-sm text-slate-400">Loading alerts...</p>
        ) : alertsError ? (
          <p className="text-sm text-yellow-400">{alertsError}</p>
        ) : (
          <MissionAlertList alerts={alerts} />
        )}
      </div>
    </div>
  );
}

