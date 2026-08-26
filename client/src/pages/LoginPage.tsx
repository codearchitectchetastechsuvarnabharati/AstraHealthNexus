// Login Page - User authentication interface
import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Alert } from '../components/Alert';

export function LoginPage() {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await auth?.login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">
            ASTRAHEALTH NEXUS
          </h1>
          <p className="text-slate-400">
            Real-time spacecraft & crew health intelligence
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-8 backdrop-blur">
          {error && (
            <Alert variant="error" onClose={() => setError('')} className="mb-6">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="your@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={auth?.isLoading}
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={auth?.isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
              >
                {showPassword ? 'Hide' : 'Show'} password
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={auth?.isLoading}
              className="mt-6"
            >
              Sign In
            </Button>
          </form>

          {/* Demo Info */}
          <div className="mt-8 border-t border-slate-800 pt-6">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Demo Credentials</p>
            <div className="space-y-2 text-xs text-slate-400">
              <div>
                <p className="font-mono text-slate-300">admin@astrahealth.com</p>
                <p className="text-slate-500">Password: any text</p>
              </div>
              <div>
                <p className="font-mono text-slate-300">ops@astrahealth.com</p>
                <p className="text-slate-500">Password: any text</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
