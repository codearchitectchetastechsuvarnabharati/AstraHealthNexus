// Internal Server Error Page - 500
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

export function ErrorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-6 text-6xl font-bold text-red-500">⚠</div>
        <h1 className="mb-3 text-3xl font-bold text-slate-100">Something Went Wrong</h1>
        <p className="mb-8 text-slate-400 max-w-md mx-auto">
          An unexpected error occurred. Our team has been notified. Please try again later or contact support.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Reload Page
          </button>
          <Link to="/">
            <Button variant="secondary">Go to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
