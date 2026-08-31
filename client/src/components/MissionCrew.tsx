// Mission Crew Component
import type { AstronautData } from '../types/api';
import { StatusIndicator } from './StatusIndicator';

interface MissionCrewProps {
  crew: AstronautData[];
  className?: string;
}

export function MissionCrew({ crew, className = '' }: MissionCrewProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {crew.map((member) => (
        <div
          key={member.id}
          className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 transition hover:border-cyan-400/30"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 font-semibold">
                  {member.name.split(' ')[0][0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-100">{member.name}</p>
                  <p className="text-xs text-slate-400">{member.role}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{member.missionSpecialty}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">{member.healthScore}%</div>
              <StatusIndicator status="active" className="mt-1 justify-end" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-slate-800/50 p-2">
              <p className="text-slate-500">Heart Rate</p>
              <p className="font-semibold text-slate-200">{member.vitalSigns.heartRate} bpm</p>
            </div>
            <div className="rounded bg-slate-800/50 p-2">
              <p className="text-slate-500">Oâ‚‚ Sat.</p>
              <p className="font-semibold text-slate-200">{member.vitalSigns.oxygenSaturation}%</p>
            </div>
            <div className="rounded bg-slate-800/50 p-2">
              <p className="text-slate-500">Pressure</p>
              <p className="font-semibold text-slate-200">{member.vitalSigns.cabinPressure} kPa</p>
            </div>
            <div className="rounded bg-slate-800/50 p-2">
              <p className="text-slate-500">Temp</p>
              <p className="font-semibold text-slate-200">{member.vitalSigns.temperature}Â°C</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}



