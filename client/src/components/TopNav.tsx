// codeauthor chetas karnam
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Problem', href: '/problem' },
  { label: 'Solution', href: '/solution' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Datasets', href: '/datasets' },
  { label: 'Research', href: '/research' },
  { label: 'Awards', href: '/awards' },
  { label: 'Team', href: '/team' },
  { label: 'Contact', href: '/contact' },
  { label: 'Mission Ops', href: '/mission-ops' }
];

export function TopNav() {
  const location = useLocation();

  return (
    <header className="flex flex-wrap items-center justify-between rounded-full border border-cyan-400/20 bg-slate-900/70 px-6 py-4 backdrop-blur">
      <Link to="/" className="text-lg font-semibold tracking-[0.35em] text-cyan-300">ASTRAHEALTH NEXUS</Link>
      <nav className="flex flex-wrap gap-3 text-sm text-slate-300">
        {navItems.map((item) => {
          const active = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`rounded-full px-3 py-1 transition ${active ? 'bg-cyan-500/20 text-cyan-200' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
