import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false, clientOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#282d34]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5ebe7d]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If specific role required
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  if (clientOnly && user.role !== 'client') {
    return <Navigate to="/admin-panel" replace />;
  }

  return children;
};

export default ProtectedRoute;