import { useEffect, useMemo, useState } from 'react';
import type { MissionAlert } from '../types/mission';
import { getAlerts } from '../services/api';
import { Input } from '../components/Input';
import { LoadingScreen } from '../components/Loading';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';

const severityRank: Record<MissionAlert['severity'], number> = { Critical: 4, Warning: 3, Info: 1 };
const severityStyles: Record<MissionAlert['severity'], string> = {
  Critical: 'border-red-400/40 bg-red-500/10 text-red-200',
  Warning: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  Info: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
};

export function AlertsPage() {
  const [alerts, setAlerts] = useState<MissionAlert[]>([]);
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'all' | MissionAlert['severity']>('all');
  const [status, setStatus] = useState<'all' | MissionAlert['status']>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      setAlerts(await getAlerts());
    } catch (err) {
      setError((err as Error).message || 'Unable to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const filteredAlerts = useMemo(() => alerts
    .filter((alert) => severity === 'all' || alert.severity === severity)
    .filter((alert) => status === 'all' || alert.status === status)
    .filter((alert) => `${alert.title} ${alert.description} ${alert.source} ${alert.affectedSubsystem}`.toLowerCase().includes(query.toLowerCase()))
    .sort((left, right) => severityRank[right.severity] - severityRank[left.severity] || new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()),
  [alerts, query, severity, status]);

  if (loading) return <LoadingScreen message="Loading alert center..." />;
  if (error) return <ErrorState message={error} retry={loadAlerts} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">Incident management</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">Alert Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Review operational conditions from the validated local mission feed.</p>
        </div>
        <button type="button" onClick={loadAlerts} className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200">
          Refresh alerts
        </button>
      </header>

      <section className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <Input aria-label="Search alerts" placeholder="Search title, source, or subsystem" value={query} onChange={(event) => setQuery(event.target.value)} />
        <label className="text-sm text-slate-400">Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)} className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"><option value="all">All severities</option><option value="Critical">Critical</option><option value="Warning">Warning</option><option value="Info">Informational</option></select></label>
        <label className="text-sm text-slate-400">Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"><option value="all">All statuses</option><option value="Active">Active</option><option value="Acknowledged">Acknowledged</option><option value="Resolved">Resolved</option></select></label>
      </section>

      {filteredAlerts.length === 0 ? <EmptyState title="No matching alerts" description="Try a different search or filter combination." icon="!" /> : (
        <section className="space-y-3" aria-label="Alert results">
          <p className="text-sm text-slate-500">{filteredAlerts.length} alert{filteredAlerts.length === 1 ? '' : 's'} shown</p>
          {filteredAlerts.map((alert) => (
            <article key={alert.id} className={`rounded-lg border p-4 ${severityStyles[alert.severity]}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-100">{alert.title}</h2><Badge variant={alert.status === 'Resolved' ? 'success' : alert.status === 'Active' ? 'primary' : 'neutral'} size="sm">{alert.status}</Badge><span className="text-xs font-semibold uppercase tracking-wider">{alert.severity}</span></div>
                  <p className="mt-2 text-sm text-slate-300">{alert.description}</p>
                  <p className="mt-3 text-xs text-slate-400">Source: {alert.source} · Subsystem: {alert.affectedSubsystem}</p>
                </div>
                <time className="shrink-0 text-xs text-slate-400" dateTime={alert.timestamp}>{new Date(alert.timestamp).toLocaleString()}</time>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
