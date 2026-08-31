// Telemetry Panel Components
import type { TelemetryMetric, TimeRange } from '../types/mission';

interface TelemetryMetricSelectorProps {
  metrics: TelemetryMetric[];
  selectedMetrics: string[];
  onSelectMetric: (metricId: string) => void;
  className?: string;
}

export function TelemetryMetricSelector({
  metrics,
  selectedMetrics,
  onSelectMetric,
  className = '',
}: TelemetryMetricSelectorProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <p className=\"text-sm font-semibold text-slate-200\">Select Metrics</p>
      <div className=\"grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4\">
        {metrics.map((metric) => (
          <button
            key={metric.id}
            onClick={() => onSelectMetric(metric.id)}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
              selectedMetrics.includes(metric.id)
                ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'
            }`}
          >
            {metric.name}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TimeRangeSelectorProps {
  selectedRange: TimeRange;
  onSelectRange: (range: TimeRange) => void;
  className?: string;
}

const timeRangeLabels: Record<TimeRange, string> = {
  'last15m': 'Last 15m',
  'last1h': 'Last 1h',
  'last6h': 'Last 6h',
  'last24h': 'Last 24h',
  'last7d': 'Last 7d',
  'custom': 'Custom',
};

export function TimeRangeSelector({
  selectedRange,
  onSelectRange,
  className = '',
}: TimeRangeSelectorProps) {
  const ranges: TimeRange[] = ['last15m', 'last1h', 'last6h', 'last24h', 'last7d'];

  return (
    <div className={`space-y-2 ${className}`}>
      <p className=\"text-sm font-semibold text-slate-200\">Time Range</p>
      <div className=\"flex flex-wrap gap-2\">
        {ranges.map((range) => (
          <button
            key={range}
            onClick={() => onSelectRange(range)}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
              selectedRange === range
                ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'
            }`}
          >
            {timeRangeLabels[range]}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TelemetrySummaryProps {
  metric: TelemetryMetric;
  className?: string;
}

const statusColors: Record<string, string> = {
  'Nominal': 'text-green-400',
  'Warning': 'text-yellow-400',
  'Critical': 'text-red-400',
};

export function TelemetrySummary({ metric, className = '' }: TelemetrySummaryProps) {
  const color = statusColors[metric.status] || 'text-slate-300';

  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/70 p-4 ${className}`}>
      <p className=\"text-xs uppercase tracking-wider text-slate-500\">{metric.name}</p>
      <div className=\"mt-3 flex items-end gap-2\">
        <div className={`text-3xl font-bold ${color}`}>{metric.currentValue}</div>
        <span className=\"mb-1 text-sm text-slate-500\">{metric.unit}</span>
      </div>
      <div className=\"mt-4 grid grid-cols-3 gap-2 text-xs\">
        {metric.minValue !== undefined && (
          <div>
            <p className=\"text-slate-500\">Min</p>
            <p className=\"font-semibold text-slate-200\">{metric.minValue}</p>
          </div>
        )}
        {metric.maxValue !== undefined && (
          <div>
            <p className=\"text-slate-500\">Max</p>
            <p className=\"font-semibold text-slate-200\">{metric.maxValue}</p>
          </div>
        )}
        {metric.average !== undefined && (
          <div>
            <p className=\"text-slate-500\">Avg</p>
            <p className=\"font-semibold text-slate-200\">{metric.average.toFixed(1)}</p>
          </div>
        )}
      </div>
      <div className=\"mt-3 rounded bg-slate-800/50 px-2 py-1 text-xs text-slate-400\">
        Status: <span className={color}>{metric.status}</span>
      </div>
    </div>
  );
}


