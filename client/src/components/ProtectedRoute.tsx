// Protected Route Component - Ensures only authenticated users can access certain routes
import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { UserRole } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole[];
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const auth = useContext(AuthContext);

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !requiredRole.includes(auth.user?.role || 'viewer')) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
