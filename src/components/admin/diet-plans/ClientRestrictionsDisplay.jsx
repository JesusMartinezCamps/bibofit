import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';

const ClientRestrictionsDisplay = ({ restrictions, conflicts }) => {
    if (!restrictions) return null;

    const renderBadge = (item, type) => {
        const hasConflict = conflicts && conflicts[item.name];
        
        const typeConfig = {
            sensitivity: {
                icon: <ShieldAlert size={14} className="text-orange-400"/>,
                classes: 'bg-orange-900/50 border-orange-700/50 text-orange-300'
            },
            condition: {
                icon: <HeartPulse size={14} className="text-red-400"/>,
                classes: 'bg-red-900/50 border-red-500/30 text-red-300'
            }
        };

        const config = typeConfig[type];

        return (
            <Badge
                key={item.id}
                variant={hasConflict ? 'destructive' : 'default'}
                className={cn(
                    'transition-all',
                    hasConflict ? 'bg-red-500/30 border-red-500/50 text-red-300' : config.classes
                )}
            >
                {item.name}
            </Badge>
        );
    };

    return (
        <div className="mt-2 space-y-2">
            {(restrictions.sensitivities?.length > 0) && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-1.5 flex items-center gap-2"><ShieldAlert size={14} className="text-orange-400"/> Sensibilidades</h4>
                    <div className="flex flex-wrap gap-1.5">
                        {restrictions.sensitivities.map(s => renderBadge(s, 'sensitivity'))}
                    </div>
                </div>
            )}
            {(restrictions.conditions?.length > 0) && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-1.5 flex items-center gap-2"><HeartPulse size={14} className="text-red-400"/> Condiciones Médicas</h4>
                    <div className="flex flex-wrap gap-1.5">
                        {restrictions.conditions.map(c => renderBadge(c, 'condition'))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientRestrictionsDisplay;