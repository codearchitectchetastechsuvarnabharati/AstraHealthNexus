// 404 Not Found Page
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-6 text-6xl font-bold text-cyan-400">404</div>
        <h1 className="mb-3 text-3xl font-bold text-slate-100">Page Not Found</h1>
        <p className="mb-8 text-slate-400 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved. Please check the URL or return to the home page.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button variant="primary">Go to Home</Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="secondary">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
