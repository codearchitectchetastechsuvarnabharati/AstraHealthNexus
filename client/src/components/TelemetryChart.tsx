import { useState } from 'react';
import type { TelemetrySeries } from '../types/mission';

interface TelemetryChartProps {
  series: TelemetrySeries[];
  height?: number;
  className?: string;
}

// Simple lightweight SVG line chart (no external deps). Intended for small-to-medium time-series.
export function TelemetryChart({ series, height = 200, className = '' }: TelemetryChartProps) {
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);

  // Find overall time range and value range
  const allPoints = series.flatMap((s) => s.dataPoints.map((p) => ({ t: new Date(p.timestamp).getTime(), v: p.value, name: s.metric.name })));

  if (allPoints.length === 0) {
    return (
      <div className={`rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-center text-slate-400 ${className}`}>
        <p>No telemetry series available</p>
      </div>
    );
  }

  const tMin = Math.min(...allPoints.map((p) => p.t));
  const tMax = Math.max(...allPoints.map((p) => p.t));
  const vMin = Math.min(...allPoints.map((p) => p.v));
  const vMax = Math.max(...allPoints.map((p) => p.v));

  const padding = { top: 12, right: 12, bottom: 28, left: 44 };
  const width = 800; // chart is responsive via overflow container
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const timeToX = (t: number) => padding.left + ((t - tMin) / (tMax - tMin || 1)) * innerWidth;
  const valueToY = (v: number) => padding.top + innerHeight - ((v - vMin) / (vMax - vMin || 1)) * innerHeight;

  // Create path for each series
  const paths = series.map((s) => {
    const d = s.dataPoints
      .map((p, i) => {
        const x = timeToX(new Date(p.timestamp).getTime());
        const y = valueToY(p.value);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
    return { id: s.metric.id, d, color: seriesColor(s.metric.id), name: s.metric.name };
  });

  // X ticks (3)
  const ticks = [tMin, (tMin + tMax) / 2, tMax];

  return (
    <div className={`overflow-auto ${className}`}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Telemetry chart">
        {/* grid lines */}
        <defs>
          <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* y axis labels */}
        <g>
          <text x={8} y={padding.top + 6} className="text-xs" fill="#94a3b8">{vMax.toFixed(2)}</text>
          <text x={8} y={padding.top + innerHeight / 2 + 4} className="text-xs" fill="#94a3b8">{((vMax + vMin) / 2).toFixed(2)}</text>
          <text x={8} y={padding.top + innerHeight + 4} className="text-xs" fill="#94a3b8">{vMin.toFixed(2)}</text>
        </g>

        {/* x axis labels */}
        <g>
          {ticks.map((t, i) => (
            <text key={i} x={timeToX(t)} y={height - 6} textAnchor="middle" fill="#94a3b8" fontSize={11}>
              {new Date(t).toLocaleTimeString()}
            </text>
          ))}
        </g>

        {/* lines */}
        <g>
          {paths.map((p, idx) => (
            <g key={p.id}>
              <path d={p.d} fill="none" stroke={p.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
        </g>

        {/* hover layer */}
        <rect
          x={padding.left}
          y={padding.top}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = (e.target as SVGRectElement).getBoundingClientRect();
            const x = e.clientX - rect.left + padding.left; // approximate
            // find nearest point
            const px = xToTime(x, tMin, tMax, innerWidth, padding.left);
            // find nearest overall point
            const nearest = allPoints.reduce((prev, curr) => (Math.abs(curr.t - px) < Math.abs(prev.t - px) ? curr : prev), allPoints[0]);
            setHover({ x: timeToX(nearest.t), y: valueToY(nearest.v), label: `${nearest.name}: ${nearest.v}` });
          }}
          onMouseLeave={() => setHover(null)}
        />

        {/* hover marker */}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={padding.top} y2={padding.top + innerHeight} stroke="#334155" strokeWidth={1} strokeDasharray="4 4" />
            <rect x={hover.x + 6} y={hover.y - 18} width={120} height={28} rx={4} fill="#0b1220" stroke="#334155" />
            <text x={hover.x + 12} y={hover.y - 2} fill="#e6eef8" fontSize={12}>{hover.label}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

function seriesColor(id: string) {
  const palette = ['#06b6d4', '#f59e0b', '#ef4444', '#6366f1', '#10b981'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  const idx = Math.abs(h) % palette.length;
  return palette[idx];
}

function xToTime(x: number, tMin: number, tMax: number, innerWidth: number, left: number) {
  const clamped = Math.max(left, Math.min(left + innerWidth, x));
  const ratio = (clamped - left) / (innerWidth || 1);
  return tMin + ratio * (tMax - tMin);
}
