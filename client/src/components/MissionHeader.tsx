// Mission Header Component
import type { Mission } from '../types/mission';
import { MissionStatusBadge } from './MissionStatusBadge';

interface MissionHeaderProps {
  mission: Mission;
  className?: string;
}

export function MissionHeader({ mission, className = '' }: MissionHeaderProps) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800 p-8 ${className}`}>
      <div className=\"flex flex-col gap-4\">
        <div className=\"flex items-start justify-between gap-4\">
          <div>
            <p className=\"text-sm uppercase tracking-widest text-cyan-400\">Mission</p>
            <h1 className=\"mt-2 text-3xl font-bold text-slate-100\">{mission.name}</h1>
            <p className=\"mt-1 text-sm text-slate-400\">ID: {mission.id}</p>
          </div>
          <MissionStatusBadge status={mission.status} phase={mission.phase} />
        </div>

        <div className=\"grid grid-cols-2 gap-4 md:grid-cols-4\">
          <div>
            <p className=\"text-xs uppercase tracking-widest text-slate-500\">Start Date</p>
            <p className=\"mt-1 text-sm font-semibold text-slate-200\">
              {new Date(mission.startDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className=\"text-xs uppercase tracking-widest text-slate-500\">Duration</p>
            <p className=\"mt-1 text-sm font-semibold text-slate-200\">{mission.duration}</p>
          </div>
          {mission.endDate && (
            <div>
              <p className=\"text-xs uppercase tracking-widest text-slate-500\">End Date</p>
              <p className=\"mt-1 text-sm font-semibold text-slate-200\">
                {new Date(mission.endDate).toLocaleDateString()}
              </p>
            </div>
          )}
          <div>
            <p className=\"text-xs uppercase tracking-widest text-slate-500\">Crew Size</p>
            <p className=\"mt-1 text-sm font-semibold text-slate-200\">{mission.crew.length} members</p>
          </div>
        </div>
      </div>
    </div>
  );
}


