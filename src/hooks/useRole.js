import { useAuth } from '@/contexts/AuthContext';

export const useRole = () => {
  const { user } = useAuth();
  
  const role = user?.role || 'free'; // Default to free if undefined
  const isFree = role === 'free';
  const isClient = role === 'client';
  const isCoach = role === 'coach';
  const isAdmin = role === 'admin';

  // Feature flags
  const canAutoBalanceMacros = !isFree;
  const canCreateUnlimitedPlans = !isFree;

  return {
    role,
    isFree,
    isClient,
    isCoach,
    isAdmin,
    canAutoBalanceMacros,
    canCreateUnlimitedPlans
  };
};