import { useMemo, useState, useEffect } from 'react';
import type { TelemetryMetric, TelemetrySeries, TimeRange } from '../types/mission';
import { TelemetryMetricSelector, TimeRangeSelector, TelemetrySummary } from './TelemetryPanel';
import { TelemetryChart } from './TelemetryChart';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './Loading';
import { getTelemetry } from '../services/api';

interface TelemetryPanelViewProps {
  metrics: TelemetryMetric[];
  series?: TelemetrySeries[]; // optional - if not provided, chart will show empty state
  className?: string;
}

export function TelemetryPanelView({ metrics, series = [], className = '' }: TelemetryPanelViewProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(metrics.map((m) => m.id).slice(0, 3));
  const [selectedRange, setSelectedRange] = useState<TimeRange>('last1h');
  const [fetchedSeries, setFetchedSeries] = useState<TelemetrySeries[]>(series);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSelectMetric = (metricId: string) => {
    setSelectedMetrics((prev) => (prev.includes(metricId) ? prev.filter((id) => id !== metricId) : [...prev, metricId]));
  };

  const visibleMetrics = useMemo(() => metrics.filter((m) => selectedMetrics.includes(m.id)), [metrics, selectedMetrics]);
  const visibleSeries = useMemo(() => fetchedSeries.filter((s) => selectedMetrics.includes(s.metric.id)), [fetchedSeries, selectedMetrics]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (selectedMetrics.length === 0) {
        setFetchedSeries([]);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTelemetry(selectedMetrics, selectedRange);
        if (!mounted) return;
        // Assume backend returns TelemetrySeries-like objects
        setFetchedSeries((data as any) as TelemetrySeries[]);
      } catch (err) {
        if (!mounted) return;
        setError((err as Error).message || 'Failed to load telemetry');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [selectedMetrics, selectedRange]);

  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/70 p-4 space-y-4 ${className}`}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Telemetry</h3>
            <div className="text-sm text-slate-400">Range: {selectedRange}</div>
          </div>

          <div className="mt-3">
            {/* Chart area */}
            {isLoading ? (
              <div className="p-6">
                <LoadingSpinner />
              </div>
            ) : error ? (
              <div className="mt-2">
                <EmptyState title="Telemetry error" description={error} />
              </div>
            ) : visibleSeries.length > 0 ? (
              <TelemetryChart series={visibleSeries} height={220} />
            ) : (
              <div className="mt-2">
                <EmptyState title="No telemetry data" description="Select metrics or provide telemetry series to view charts." />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <TelemetryMetricSelector metrics={metrics} selectedMetrics={selectedMetrics} onSelectMetric={onSelectMetric} />
          <TimeRangeSelector selectedRange={selectedRange} onSelectRange={(r) => setSelectedRange(r)} />
        </div>
      </div>

      {/* Summaries */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visibleMetrics.map((m) => (
          <TelemetrySummary key={m.id} metric={m} />
        ))}
      </div>
    </div>
  );
}
