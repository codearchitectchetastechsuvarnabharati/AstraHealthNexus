// Sidebar Component - Navigation sidebar for the app shell
import { useContext, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getVisibleNavigation, NavigationSection } from '../config/navigation';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const auth = useContext(AuthContext);
  const [visibleNavigation, setVisibleNavigation] = useState<NavigationSection[]>([]);

  useEffect(() => {
    setVisibleNavigation(
      getVisibleNavigation(auth?.isAuthenticated || false, auth?.user?.role)
    );
  }, [auth?.isAuthenticated, auth?.user?.role]);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 overflow-y-auto
          border-r border-slate-800/50 bg-slate-950/95 backdrop-blur
          transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:top-0 md:h-screen
        `}
      >
        <nav className="space-y-6 p-6">
          {visibleNavigation.map((section, idx) => (
            <div key={idx}>
              {section.title && (
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {section.title}
                </h3>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.href}
                        onClick={() => onClose()}
                        className={`
                          flex items-center gap-3 rounded-lg px-4 py-2.5
                          transition-colors duration-200
                          ${
                            isActive
                              ? 'bg-cyan-500/20 text-cyan-200'
                              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                          }
                        `}
                      >
                        {item.icon && <span className="text-lg">{item.icon}</span>}
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
