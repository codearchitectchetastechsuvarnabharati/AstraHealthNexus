// Mission Timeline Component
import type { MissionEvent } from '../types/mission';

interface MissionTimelineProps {
  events: MissionEvent[];
  className?: string;
}

const severityColors: Record<MissionEvent['severity'], string> = {
  'Info': 'bg-blue-500/20 text-blue-200 border-blue-500/50',
  'Warning': 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50',
  'Critical': 'bg-red-500/20 text-red-200 border-red-500/50',
};

const typeIcons: Record<MissionEvent['type'], string> = {
  'System': 'âš™ï¸',
  'Crew': 'ðŸ‘¤',
  'Navigation': 'ðŸ§­',
  'Science': 'ðŸ”¬',
  'Maintenance': 'ðŸ”§',
  'Alert': 'âš ï¸',
};

export function MissionTimeline({ events, className = '' }: MissionTimelineProps) {
  if (events.length === 0) {
    return (
      <div className={`rounded-lg border border-slate-800 bg-slate-900/70 p-8 text-center ${className}`}>
        <p className=\"text-slate-400\">No timeline events available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {events.map((event, index) => (
        <div key={event.id} className=\"relative\">
          {/* Timeline connector */}
          {index < events.length - 1 && (
            <div className=\"absolute left-6 top-16 h-6 w-px bg-slate-700\" />
          )}

          {/* Event card */}
          <div className={`rounded-lg border ${severityColors[event.severity]} p-4`}>
            <div className=\"flex gap-4\">
              {/* Icon */}
              <div className=\"flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800/50 text-xl\">
                {typeIcons[event.type]}
              </div>

              {/* Content */}
              <div className=\"flex-1\">
                <div className=\"flex items-start justify-between\">
                  <div>
                    <p className=\"font-semibold text-slate-100\">{event.title}</p>
                    <p className=\"mt-1 text-sm text-slate-300\">{event.description}</p>
                  </div>
                  <span className=\"shrink-0 rounded bg-slate-800/50 px-2 py-1 text-xs font-medium\">
                    {event.status}
                  </span>
                </div>
                <div className=\"mt-2 flex items-center gap-4 text-xs text-slate-400\">
                  <span>{event.type}</span>
                  <span>â€¢</span>
                  <time dateTime={event.timestamp}>
                    {new Date(event.timestamp).toLocaleString()}
                  </time>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


