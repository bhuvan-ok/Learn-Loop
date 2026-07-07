import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin" />
    </div>
  );
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function RoleRoute({ role, roles, children }) {
  const { user, loading } = useAuth();
  const allowed = roles || (role ? [role] : []);
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
