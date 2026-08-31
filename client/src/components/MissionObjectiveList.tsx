// Mission Objectives Component
import type { MissionObjective } from '../types/mission';
import { Badge } from './Badge';

interface MissionObjectiveListProps {
  objectives: MissionObjective[];
  className?: string;
}

const priorityColor: Record<MissionObjective['priority'], string> = {
  'Low': 'bg-blue-500/20 text-blue-200',
  'Medium': 'bg-yellow-500/20 text-yellow-200',
  'High': 'bg-orange-500/20 text-orange-200',
  'Critical': 'bg-red-500/20 text-red-200',
};

const statusIcon: Record<MissionObjective['status'], string> = {
  'Planned': 'â—¯',
  'In Progress': 'â—',
  'Completed': 'â—‰',
  'Blocked': 'âœ•',
};

export function MissionObjectiveList({ objectives, className = '' }: MissionObjectiveListProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {objectives.map((objective) => (
        <div
          key={objective.id}
          className=\"rounded-lg border border-slate-800 bg-slate-900/70 p-4 transition hover:border-cyan-400/30\"
        >
          <div className=\"flex items-start justify-between gap-3\">
            <div className=\"flex-1\">
              <div className=\"flex items-center gap-2\">
                <span className=\"text-lg text-cyan-400\">{statusIcon[objective.status]}</span>
                <h3 className=\"font-semibold text-slate-100\">{objective.name}</h3>
              </div>
              <p className=\"mt-2 text-sm text-slate-400\">{objective.description}</p>
              <div className=\"mt-3 flex items-center gap-2\">
                <div className=\"flex-1 rounded-full bg-slate-800 h-2\">
                  <div
                    className=\"h-full rounded-full bg-cyan-500 transition-all\"
                    style={{ width: `${objective.completionPercentage}%` }}
                  />
                </div>
                <span className=\"text-xs text-slate-400\">{objective.completionPercentage}%</span>
              </div>
            </div>
            <Badge variant=\"primary\" size=\"sm\">
              {objective.priority}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}


