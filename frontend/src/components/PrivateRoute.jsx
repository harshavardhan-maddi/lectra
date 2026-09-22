import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-customBg dark:bg-customBg-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="text-customText-muted dark:text-customText-mutedDark font-medium">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'SUPER_ADMIN') {
    return children;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    let defaultRoute = '/login';
    if (user?.role === 'CR') {
      defaultRoute = '/cr-dashboard';
    } else if (user?.role === 'ABSENT_CONTROLLER') {
      defaultRoute = '/absent-controller';
    } else if (user?.role === 'FACULTY') {
      defaultRoute = '/faculty-dashboard';
    } else if (user?.role === 'WATCHMAN') {
      defaultRoute = '/watchman-dashboard';
    } else if (user?.role === 'HOD' || user?.role === 'SUB_ADMIN' || user?.role === 'SUPER_ADMIN') {
      defaultRoute = '/dashboard';
    }
    return <Navigate to={defaultRoute} replace />;
  }

  return children;
};

export default PrivateRoute;
