// codeauthor chetas karnam
export function MissionOpsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/70 p-10">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">Mission Operations</p>
        <h1 className="mt-4 text-4xl font-semibold">Telemetry ingestion and historical trend tracking are live.</h1>
        <p className="mt-6 text-lg text-slate-300">The backend now performs scheduled ingestion from public orbital and space-weather sources and exposes a telemetry history endpoint for operations analysis.</p>
      </div>
    </main>
  );
}
