// Mission Status Badge Component
import { StatusIndicator } from './StatusIndicator';
import type { Mission } from '../types/mission';

interface MissionStatusBadgeProps {
  status: Mission['status'];
  phase?: Mission['phase'];
  className?: string;
}

const statusColors: Record<Mission['status'], { dot: string; text: string }> = {
  'Operational': { dot: 'bg-green-500', text: 'text-green-200' },
  'Nominal': { dot: 'bg-blue-500', text: 'text-blue-200' },
  'Warning': { dot: 'bg-yellow-500', text: 'text-yellow-200' },
  'Critical': { dot: 'bg-red-500', text: 'text-red-200' },
  'Offline': { dot: 'bg-gray-500', text: 'text-gray-200' },
  'Unknown': { dot: 'bg-slate-500', text: 'text-slate-200' },
};

export function MissionStatusBadge({ status, phase, className = '' }: MissionStatusBadgeProps) {
  const colors = statusColors[status];
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`flex items-center gap-2 rounded-full border ${colors.text} border-opacity-30 px-3 py-1.5 text-sm font-medium`}>
        <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
        {status}
      </div>
      {phase && (
        <span className="text-xs text-slate-400">
          {phase}
        </span>
      )}
    </div>
  );
}
