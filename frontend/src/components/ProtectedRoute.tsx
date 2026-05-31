import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext.js';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div>Checking authentication...</div>;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  return <Outlet />;
}
