// Mission KPI Card Component
import type { MissionKPI } from '../types/mission';

interface MissionKpiCardProps {
  kpi: MissionKPI;
  isLoading?: boolean;
  className?: string;
}

const statusColors: Record<string, string> = {
  'Nominal': 'text-green-400',
  'Warning': 'text-yellow-400',
  'Critical': 'text-red-400',
};

const trendIcons: Record<string, string> = {
  'Up': '↑',
  'Down': '↓',
  'Stable': '→',
};

export function MissionKpiCard({ kpi, isLoading = false, className = '' }: MissionKpiCardProps) {
  const statusColor = statusColors[kpi.status] || 'text-slate-300';
  const trend = kpi.trend ? trendIcons[kpi.trend] || '' : '';

  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/70 p-4 ${className}`}>
      <p className="text-xs uppercase tracking-wider text-slate-500">{kpi.label}</p>
      
      {isLoading ? (
        <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-800" />
      ) : (
        <div className="mt-3 flex items-end gap-2">
          <div className={`text-2xl font-bold ${statusColor}`}>
            {kpi.value}
          </div>
          <span className="mb-1 text-xs text-slate-500">{kpi.unit}</span>
          {trend && (
            <span className={`mb-1 ml-2 ${statusColor}`}>
              {trend}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-500">{kpi.status}</span>
        <span className="text-xs text-slate-600">
          {new Date(kpi.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
