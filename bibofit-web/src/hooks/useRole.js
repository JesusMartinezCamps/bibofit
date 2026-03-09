import { useAuth } from '@/contexts/AuthContext';
import {
  isAdminRole,
  isClientRole,
  isCoachRole,
  normalizeRole,
} from '@/lib/roles';

export const useRole = () => {
  const { user } = useAuth();

  const role = normalizeRole(user?.role || 'free');
  const isFree = role === 'free';
  const isClient = isClientRole(role);
  const isCoach = isCoachRole(role);
  const isAdmin = isAdminRole(role);

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
