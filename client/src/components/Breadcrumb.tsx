// Breadcrumb Component - Shows current page path
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { navigationConfig } from '../config/navigation';

export function Breadcrumb() {
  const location = useLocation();

  const breadcrumbs = useMemo(() => {
    const path = location.pathname;

    // Find the label for current path from navigation config
    let label = 'Page';
    for (const section of navigationConfig) {
      for (const item of section.items) {
        if (item.href === path) {
          label = item.label;
          break;
        }
      }
    }

    return [
      { label: 'Home', href: '/' },
      { label, href: path, current: true },
    ];
  }, [location.pathname]);

  return (
    <nav className="flex items-center gap-2 px-6 py-4 text-sm">
      {breadcrumbs.map((crumb, idx) => (
        <div key={idx} className="flex items-center gap-2">
          {idx > 0 && <span className="text-slate-600">/</span>}
          {crumb.current ? (
            <span className="text-slate-400">{crumb.label}</span>
          ) : (
            <Link to={crumb.href} className="text-cyan-400 hover:text-cyan-300">
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
