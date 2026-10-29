// Missions List Page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Mission } from '../types/mission';
import { getMissions, getISS, getAstronauts, getSpaceWeather, getRocket } from '../services/api';
import { MissionCard } from '../components/MissionCard';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { LoadingScreen } from '../components/Loading';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';

export function MissionsListPage() {
  const navigate = useNavigate();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Mission['status'] | 'all'>('all');
  const [phaseFilter, setPhaseFilter] = useState<Mission['phase'] | 'all'>('all');

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getMissions();
      setMissions(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to load missions');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMissions = missions.filter((mission) => {
    const matchesSearch =
      mission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mission.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || mission.status === statusFilter;
    const matchesPhase = phaseFilter === 'all' || mission.phase === phaseFilter;
    return matchesSearch && matchesStatus && matchesPhase;
  });

  if (isLoading) {
    return <LoadingScreen message="Loading missions..." />;
  }

  if (error) {
    return <ErrorState message={error} retry={loadMissions} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Missions</h1>
        <p className="mt-2 text-slate-400">Manage and monitor active and past missions</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <div className="space-y-4">
          <Input
            placeholder="Search by mission name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Mission['status'] | 'all')}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'Operational', label: 'Operational' },
                { value: 'Nominal', label: 'Nominal' },
                { value: 'Warning', label: 'Warning' },
                { value: 'Critical', label: 'Critical' },
                { value: 'Offline', label: 'Offline' },
                { value: 'Unknown', label: 'Unknown' },
              ]}
            />

            <Select
              label="Phase"
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value as Mission['phase'] | 'all')}
              options={[
                { value: 'all', label: 'All Phases' },
                { value: 'Planning', label: 'Planning' },
                { value: 'Pre-Launch', label: 'Pre-Launch' },
                { value: 'Active Orbital Operations', label: 'Active Orbital Operations' },
                { value: 'Return Preparation', label: 'Return Preparation' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {filteredMissions.length === 0 ? (
        <EmptyState
          title="No missions found"
          description="Try adjusting your filters or search terms"
          icon="ðŸš€"
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Showing {filteredMissions.length} mission(s)</p>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredMissions.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

