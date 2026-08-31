// Station Status Component
import type { StationInfo } from '../types/mission';
import { DataFreshnessIndicator } from './DataFreshnessIndicator';

interface StationStatusProps {
  station: StationInfo;
  className?: string;
}

const statusColor: Record<StationInfo['status'], string> = {
  'Operational': 'bg-green-500/20 border-green-500/50 text-green-200',
  'Offline': 'bg-red-500/20 border-red-500/50 text-red-200',
  'Limited': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200',
};

export function StationStatus({ station, className = '' }: StationStatusProps) {
  return (
    <div className={`rounded-xl border ${statusColor[station.status]} p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold">{station.name}</h3>
          <p className="mt-2 text-sm font-semibold">Status: {station.status}</p>
        </div>
        <div className={`h-4 w-4 rounded-full ${station.status === 'Operational' ? 'bg-green-500 animate-pulse' : 'bg-current'}`} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        <div className="rounded bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Latitude</p>
          <p className="mt-1 font-semibold text-slate-200">{station.latitude.toFixed(4)}Â°</p>
        </div>
        <div className="rounded bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Longitude</p>
          <p className="mt-1 font-semibold text-slate-200">{station.longitude.toFixed(4)}Â°</p>
        </div>
        <div className="rounded bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Altitude</p>
          <p className="mt-1 font-semibold text-slate-200">{station.altitude.toFixed(1)} km</p>
        </div>
        <div className="rounded bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Velocity</p>
          <p className="mt-1 font-semibold text-slate-200">{station.velocity.toFixed(0)} km/s</p>
        </div>
        <div className="rounded bg-slate-900/50 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Last Update</p>
          <p className="mt-1 text-xs font-semibold text-slate-200">
            {new Date(station.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <DataFreshnessIndicator lastUpdated={station.lastUpdated} isStale={false} />
      </div>
    </div>
  );
}



