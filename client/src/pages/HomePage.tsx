// codeauthor chetas karnam
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';

export function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f172a,_#020617_45%,_#01040b)] px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between rounded-full border border-cyan-400/20 bg-slate-900/70 px-6 py-4 backdrop-blur">
          <div className="text-lg font-semibold tracking-[0.35em] text-cyan-300">ASTRAHEALTH NEXUS</div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="rounded-3xl border border-cyan-500/20 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.4em] text-cyan-400">Real-Time Spacecraft & Crew Health Intelligence</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-6xl">AstraHealth Nexus powers deep-space mission decisions with live telemetry and predictive insight.</h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">The platform fuses live orbital data, environmental conditions, biomedical signals, and mission events into a deployable aerospace operations command layer.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/login">
                <Button variant="primary" size="lg">Open Dashboard</Button>
              </Link>
              <Link to="/research">
                <Button variant="secondary" size="lg">Review Research</Button>
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Mission Signal</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-lg font-semibold">Telemetry stream active</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                <li>• ISS orbital state and public telemetry ingested in near real time</li>
                <li>• NOAA space-weather conditions normalized for operations</li>
                <li>• Biomedical and environmental datasets stored for historical analysis</li>
              </ul>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-6 mt-8 md:grid-cols-2 lg:grid-cols-4">
          <Link to="/problem" className="p-4 rounded-lg border border-slate-800 bg-slate-900/70 hover:border-cyan-400/50 hover:bg-slate-900/90 transition">
            <div className="text-2xl mb-2">❓</div>
            <h3 className="font-semibold text-slate-100">The Problem</h3>
            <p className="text-sm text-slate-400 mt-2">Learn about mission-critical challenges</p>
          </Link>
          <Link to="/solution" className="p-4 rounded-lg border border-slate-800 bg-slate-900/70 hover:border-cyan-400/50 hover:bg-slate-900/90 transition">
            <div className="text-2xl mb-2">💡</div>
            <h3 className="font-semibold text-slate-100">Our Solution</h3>
            <p className="text-sm text-slate-400 mt-2">Discover how we solve it</p>
          </Link>
          <Link to="/team" className="p-4 rounded-lg border border-slate-800 bg-slate-900/70 hover:border-cyan-400/50 hover:bg-slate-900/90 transition">
            <div className="text-2xl mb-2">👥</div>
            <h3 className="font-semibold text-slate-100">The Team</h3>
            <p className="text-sm text-slate-400 mt-2">Meet our experts</p>
          </Link>
          <Link to="/contact" className="p-4 rounded-lg border border-slate-800 bg-slate-900/70 hover:border-cyan-400/50 hover:bg-slate-900/90 transition">
            <div className="text-2xl mb-2">📧</div>
            <h3 className="font-semibold text-slate-100">Contact</h3>
            <p className="text-sm text-slate-400 mt-2">Get in touch with us</p>
          </Link>
        </section>
      </div>
    </div>
  );
}
