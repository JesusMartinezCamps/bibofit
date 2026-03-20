import React from 'react';
    import { Badge } from '@/components/ui/badge';
    import { cn } from '@/lib/utils';
    import { ShieldAlert, HeartPulse } from 'lucide-react';

    const InfoBadge = ({ item, type, className }) => {
        if (!item || !item.name) return null;

        const config = {
            sensitivity: {
                variant: 'destructive',
                colorClasses: 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/50 dark:border-orange-700/50 dark:text-orange-300',
                icon: <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-orange-500 dark:text-orange-400" />
            },
            medical_condition: {
                variant: 'secondary',
                colorClasses: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-500/30 dark:text-red-300',
                icon: <HeartPulse className="w-3.5 h-3.5 mr-1.5 text-red-500 dark:text-red-400" />
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