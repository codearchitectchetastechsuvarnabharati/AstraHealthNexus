// codeauthor chetas karnam
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { TopNav } from '../components/TopNav';
import { MetricCard } from '../components/MetricCard';
import { getDashboardSnapshot } from '../services/api';
import type { DashboardSnapshot } from '../types/api';

type MetricTile = {
  label: string;
  value: number;
  unit: string;
};

export function DashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [statusMessage, setStatusMessage] = useState('Connecting to offline datasets...');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());

  const loadDashboard = async () => {
    setStatusMessage('Reading mission snapshot from local datasets...');
    try {
      const data = await getDashboardSnapshot();
      setSnapshot(data);
      setLastUpdated(data.lastUpdated);
      setStatusMessage('Offline mission snapshot is current.');
    } catch (error) {
      setStatusMessage(`Unable to load live dashboard: ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, 18000);
    return () => window.clearInterval(intervalId);
  }, []);

  const healthTiles: MetricTile[] = [
    { label: 'Crew health', value: snapshot?.crewAndVehicleHealth?.astronautHealthScore ?? 0, unit: '%' },
    { label: 'Rocket health', value: snapshot?.crewAndVehicleHealth?.rocketHealthScore ?? 0, unit: '%' },
    { label: 'Space weather index', value: snapshot?.spaceWeatherKPIndex ?? 0, unit: '' }
  ];

  const objectiveCount = snapshot?.missionObjectives.length ?? 0;
  const missionCrewCount = snapshot?.missionCrew.length ?? 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_45%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <TopNav />

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-slate-900/70 shadow-[0_0_80px_rgba(34,211,238,0.15)]"
        >
          <div className="border-b border-white/10 p-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-3xl">
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">Offline intelligence dashboard</p>
                <h1 className="mt-3 text-5xl font-semibold text-white">AstraHealth Nexus 2.0</h1>
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  Everything you see here is sourced from local space datasets and delivered through a strong offline backend. No hard-coded telemetry; every panel reflects the actual mission data stored on disk.
                </p>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                Dataset status • {snapshot ? 'Synced' : 'Pending'}
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-8 md:grid-cols-3">
            <MetricCard title="Mission status" value={snapshot?.missionStatus ?? 'Starting...'} detail="Offline source integrity" />
            <MetricCard title="Orbit" value={snapshot?.orbit ?? 'Estimating...'} detail="Derived from local telemetry" />
            <MetricCard title="Space weather" value={snapshot?.spaceWeatherStatus ?? 'Loading...'} detail={`KP index ${snapshot?.spaceWeatherKPIndex ?? '-'}`} />
          </div>

          <div className="grid gap-6 px-8 pb-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Crew & vehicle</p>
                  <p className="mt-1 text-xs text-slate-500">Mission health derived from local datasets</p>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">{snapshot?.crewAndVehicleHealth?.astronautStatus ?? 'Offline sync'}</span>
              </div>
              <p className="mt-5 text-5xl font-semibold text-white">{snapshot?.crewAndVehicleHealth?.astronautHealthScore ?? 0}%</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{snapshot?.crewAndVehicleHealth?.astronautNarrative ?? 'Crew condition analysis available after the first dataset refresh.'}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Oxygen', value: snapshot?.crewAndVehicleHealth?.astronautVitalSigns?.oxygen ?? 0, unit: '%' },
                  { label: 'Heart rate', value: snapshot?.crewAndVehicleHealth?.astronautVitalSigns?.heartRate ?? 0, unit: ' bpm' },
                  { label: 'Cabin pressure', value: snapshot?.crewAndVehicleHealth?.astronautVitalSigns?.cabinPressure ?? 0, unit: ' kPa' }
                ].map((tile) => (
                  <div key={tile.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{tile.label}</p>
                    <p className="mt-2 text-xl font-semibold text-white">{tile.value}{tile.unit}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Flight systems</p>
                  <p className="mt-1 text-xs text-slate-500">Engine and avionics status from local rocket logs</p>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">{snapshot?.crewAndVehicleHealth?.rocketStatus ?? 'Offline sync'}</span>
              </div>
              <p className="mt-5 text-5xl font-semibold text-white">{snapshot?.crewAndVehicleHealth?.rocketHealthScore ?? 0}%</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{snapshot?.crewAndVehicleHealth?.rocketNarrative ?? 'Rocket performance details available from local rocket dataset.'}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Thrust', value: snapshot?.crewAndVehicleHealth?.rocketSystems?.thrust ?? 0, unit: '%' },
                  { label: 'Fuel pressure', value: snapshot?.crewAndVehicleHealth?.rocketSystems?.fuelPressure ?? 0, unit: '%' },
                  { label: 'Thermal', value: snapshot?.crewAndVehicleHealth?.rocketSystems?.thermal ?? 0, unit: '%' }
                ].map((tile) => (
                  <div key={tile.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{tile.label}</p>
                    <p className="mt-2 text-xl font-semibold text-white">{tile.value}{tile.unit}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-8 pt-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-inner shadow-cyan-500/10">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Mission objectives</p>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">{objectiveCount} objectives</span>
              </div>
              <div className="mt-6 space-y-4">
                {snapshot?.missionObjectives.map((objective, index) => (
                  <div key={`${objective}-${index}`} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="font-medium text-white">{objective}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45 }}
                className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6"
              >
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">NASA dataset context</p>
                <p className="mt-4 text-sm leading-6 text-slate-300">{snapshot?.nasaHighlight ?? 'Dataset insights are parsed from local NASA payloads.'}</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Asteroid summary</p>
                    <p className="mt-3 text-sm text-white">{snapshot?.nasaAsteroidSummary ?? 'Not available in current dataset'}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Solar flux</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{snapshot?.solarFlux ?? '-'}</p>
                  </div>
                </div>
              </motion.div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Sensor intelligence</p>
                <div className="mt-6 grid gap-3">
                  {healthTiles.map((tile) => (
                    <div key={tile.label} className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">{tile.label}</p>
                        <p className="text-xs text-slate-500">Updated from local dataset feed</p>
                      </div>
                      <p className="text-2xl font-semibold text-cyan-300">{tile.value}{tile.unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-t border-white/10 p-8 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Crew manifest</p>
              <div className="mt-5 space-y-3">
                {snapshot?.missionCrew.map((crew, index) => (
                  <div key={`${crew}-${index}`} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                    <p className="font-medium text-white">{crew}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Backend status</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-sm text-slate-400">Last snapshot update</p>
                  <p className="mt-2 text-xl font-semibold text-white">{lastUpdated}</p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-sm text-slate-400">Data source</p>
                  <p className="mt-2 text-xl font-semibold text-white">Local JSON datasets</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Data integrity</p>
              <div className="mt-5 space-y-4 text-sm text-slate-300">
                <p>{statusMessage}</p>
                <p>All displayed values are derived from validated local datasets and are available offline.</p>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
