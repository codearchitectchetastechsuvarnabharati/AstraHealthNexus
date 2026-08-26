// Top Navigation Bar - Header component for the app shell
import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Button } from './Button';

interface TopNavBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function TopNavBar({ sidebarOpen, onToggleSidebar }: TopNavBarProps) {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    auth?.logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-2 hover:bg-slate-800 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg
              className="h-6 w-6 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <Link to="/" className="text-lg font-bold tracking-wide text-cyan-400">
            ASTRAHEALTH NEXUS
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {auth?.isAuthenticated ? (
            <>
              <div className="text-sm text-slate-300">
                {auth.user?.name && <span>{auth.user.name}</span>}
                {auth.user?.role && (
                  <span className="ml-2 text-xs text-slate-500">
                    ({auth.user.role})
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
