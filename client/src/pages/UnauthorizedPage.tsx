// Unauthorized Access Page - 403 Forbidden
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

export function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-6 text-6xl font-bold text-red-500">⛔</div>
        <h1 className="mb-3 text-3xl font-bold text-slate-100">Access Denied</h1>
        <p className="mb-8 text-slate-400 max-w-md mx-auto">
          You don't have permission to access this page. Please contact your administrator if you believe this is an error.
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
