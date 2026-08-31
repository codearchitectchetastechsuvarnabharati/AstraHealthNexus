// Operational Status Component
import type { Mission } from '../types/mission';

interface OperationalStatusProps {
  mission: Mission;
  className?: string;
}

export function OperationalStatus({ mission, className = '' }: OperationalStatusProps) {
  const statusColor: Record<Mission['status'], string> = {
    'Operational': 'bg-green-500/20 border-green-500/50 text-green-200',
    'Nominal': 'bg-blue-500/20 border-blue-500/50 text-blue-200',
    'Warning': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200',
    'Critical': 'bg-red-500/20 border-red-500/50 text-red-200',
    'Offline': 'bg-slate-500/20 border-slate-500/50 text-slate-200',
    'Unknown': 'bg-slate-700/20 border-slate-600/50 text-slate-300',
  };

  return (
    <div className={`rounded-lg border ${statusColor[mission.status]} p-4 ${className}`}>
      <div className=\"flex items-center justify-between\">
        <div>
          <p className=\"text-sm font-semibold\">{mission.status}</p>
          <p className=\"text-xs opacity-80\">{mission.phase}</p>
        </div>
        <div className={`h-3 w-3 rounded-full ${mission.status === 'Operational' || mission.status === 'Nominal' ? 'bg-green-500 animate-pulse' : 'bg-current'}`} />
      </div>
    </div>
  );
}


