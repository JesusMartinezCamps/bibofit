import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole } from '@/lib/roles';
import TrainingComingSoon from './TrainingComingSoon';

const TrainingAdminGuard = ({ children }) => {
  const { user } = useAuth();

  if (!isAdminRole(user?.role)) {
    return <TrainingComingSoon />;
  }

  return children;
};

export default TrainingAdminGuard;
