import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export const useAutoFrameAccess = () => {
    const { user } = useAuth();
    
    // Get role from user object (populated from user_roles in AuthContext)
    const role = user?.role ? user.role.toLowerCase() : 'free';

    const accessInfo = useMemo(() => {
        // 'client' role corresponds to Premium plan
        // 'coach' and 'admin' also have access
        const canUseAutoFrame = ['client', 'coach', 'admin'].includes(role);
        
        return {
            canUseAutoFrame,
            message: canUseAutoFrame 
                ? null 
                : "Esta funcionalidad está disponible solo para usuarios Premium. Actualiza tu plan para acceder al autocuadre automático.",
            link: '/pricing'
        };
    }, [role]);

    return accessInfo;
};