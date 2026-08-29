// codeauthor chetas karnam
export function SolutionPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/70 p-10">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">Solution Architecture</p>
        <h1 className="mt-4 text-4xl font-semibold">A modular architecture for ingestion, analysis, and decision support.</h1>
        <p className="mt-6 text-lg text-slate-300">The platform uses an Express backend, time-series-ready persistence, scheduled ingestion tasks, and WebSocket-ready updates to keep mission dashboards responsive and dependable.</p>
      </div>
    </main>
  );
}
