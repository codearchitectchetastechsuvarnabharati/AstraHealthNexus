// Mission Card Component (for list view)
import { Link } from 'react-router-dom';
import type { Mission } from '../types/mission';
import { MissionStatusBadge } from './MissionStatusBadge';

interface MissionCardProps {
  mission: Mission;
  className?: string;
}

export function MissionCard({ mission, className = '' }: MissionCardProps) {
  return (
    <Link
      to={`/missions/${mission.id}`}
      className={`block rounded-lg border border-slate-800 bg-slate-900/70 p-6 transition hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-900/30 ${className}`}
    >
      <div className=\"flex items-start justify-between gap-4\">
        <div className=\"flex-1\">
          <h3 className=\"text-lg font-semibold text-slate-100\">{mission.name}</h3>
          <p className=\"mt-1 text-xs text-slate-500\">ID: {mission.id}</p>

          <p className=\"mt-3 text-sm text-slate-300\">{mission.phase}</p>

          <div className=\"mt-4 flex flex-wrap gap-2\">
            <div className=\"rounded bg-slate-800/50 px-2 py-1 text-xs text-slate-400\">
              Started: {new Date(mission.startDate).toLocaleDateString()}
            </div>
            <div className=\"rounded bg-slate-800/50 px-2 py-1 text-xs text-slate-400\">
              Crew: {mission.crew.length}
            </div>
            <div className=\"rounded bg-slate-800/50 px-2 py-1 text-xs text-slate-400\">
              Objectives: {mission.objectives.length}
            </div>
          </div>
        </div>
        <div>
          <MissionStatusBadge status={mission.status} />
        </div>
      </div>
    </Link>
  );
}


