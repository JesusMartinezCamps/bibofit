import React from 'react';
    import { Badge } from '@/components/ui/badge';
    import { cn } from '@/lib/utils';
    import { ShieldAlert, HeartPulse } from 'lucide-react';

    const InfoBadge = ({ item, type, className }) => {
        if (!item || !item.name) return null;

        const config = {
            sensitivity: {
                variant: 'destructive',
                colorClasses: 'bg-orange-900/50 border-orange-700/50 text-orange-300',
                icon: <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-orange-400" />
            },
            medical_condition: {
                variant: 'secondary',
                colorClasses: 'bg-red-900/50 border-red-500/30 text-red-300',
                icon: <HeartPulse className="w-3.5 h-3.5 mr-1.5 text-red-400" />
            }
        };
        
        const { variant, colorClasses, icon } = config[type] || {};

        if (!variant) return null;

        return (
            <Badge variant={variant} className={cn('flex items-center pointer-events-none', colorClasses, className)}>
                {icon}
                {item.name}
            </Badge>
        );
    };

    export default InfoBadge;