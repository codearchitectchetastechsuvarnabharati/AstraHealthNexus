// Mission Alerts Component
import type { MissionAlert } from '../types/mission';
import { Badge } from './Badge';

interface MissionAlertListProps {
  alerts: MissionAlert[];
  onAlertClick?: (alert: MissionAlert) => void;
  className?: string;
}

const severityColor: Record<MissionAlert['severity'], string> = {
  'Info': 'bg-blue-500/20 border-blue-500/50 text-blue-200',
  'Warning': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200',
  'Critical': 'bg-red-500/20 border-red-500/50 text-red-200',
};

const statusBadgeVariant: Record<MissionAlert['status'], 'primary' | 'secondary' | 'outline'> = {
  'Active': 'primary',
  'Acknowledged': 'secondary',
  'Resolved': 'outline',
};

export function MissionAlertList({
  alerts,
  onAlertClick,
  className = '',
}: MissionAlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className={`rounded-lg border border-slate-800 bg-slate-900/70 p-8 text-center ${className}`}>
        <p className=\"text-slate-400\">No active alerts</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          onClick={() => onAlertClick?.(alert)}
          className={`cursor-pointer rounded-lg border transition ${
            onAlertClick ? 'hover:border-cyan-400/50 hover:bg-slate-800/70' : ''
          } ${severityColor[alert.severity]} p-4`}
        >
          <div className=\"flex items-start justify-between gap-3\">
            <div className=\"flex-1\">
              <div className=\"flex items-center gap-2\">
                <h4 className=\"font-semibold text-slate-100\">{alert.title}</h4>
                <Badge variant={statusBadgeVariant[alert.status]} size=\"xs\">
                  {alert.status}
                </Badge>
              </div>
              <p className=\"mt-1 text-sm text-slate-300\">{alert.description}</p>
              <div className=\"mt-2 flex flex-wrap gap-3 text-xs text-slate-400\">
                <span>Source: {alert.source}</span>
                <span>â€¢</span>
                <span>Subsystem: {alert.affectedSubsystem}</span>
                <span>â€¢</span>
                <time dateTime={alert.timestamp}>
                  {new Date(alert.timestamp).toLocaleString()}
                </time>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


