// App Layout - Main layout wrapper for authenticated pages
import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TopNavBar } from './TopNavBar';
import { Sidebar } from './Sidebar';
import { Breadcrumb } from './Breadcrumb';

interface AppLayoutProps {
  children: ReactNode;
  showBreadcrumb?: boolean;
  title?: string;
}

export function AppLayout({ children, showBreadcrumb = true, title }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <TopNavBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main
          className={`
            flex-1 transition-all duration-300
            ${sidebarOpen ? 'ml-64' : 'ml-0'}
          `}
        >
          {showBreadcrumb && <Breadcrumb />}

          <div className="p-6 md:p-10">
            {title && (
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-100">{title}</h1>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
