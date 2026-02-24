
import React from 'react';
import MacroProgress from './MacroProgress';
import CaloriesProgress from './CaloriesProgress';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const MacroVisualizer = ({ currentTarget, actual, loading, isSticky = false }) => {
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                </div>
                <Skeleton className="h-10" />
            </div>
        );
    }
    
    return (
        <div className={cn(
            "space-y-4 sm:space-y-6 transition-all duration-300",
            isSticky 
              ? "sticky !top-0 z-40 p-3 sm:p-4 bg-gray-900/95 backdrop-blur-md rounded-b-2xl border-b border-x border-gray-800 shadow-xl [filter:drop-shadow(0_4px_6px_rgb(0_0_0/50%))]" 
              : "bg-gray-900/50 p-2 sm:p-6 rounded-xl"
        )}>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <MacroProgress
                    icon={<ProteinIcon className="w-5 h-5 text-red-400" />}
                    name="Proteínas"
                    actual={actual.proteins}
                    target={currentTarget.proteins}
                    color="red"
                />
                <MacroProgress
                    icon={<CarbsIcon className="w-5 h-5 text-yellow-400" />}
                    name="Carbohidratos"
                    actual={actual.carbs}
                    target={currentTarget.carbs}
                    color="yellow" 
                />
                <MacroProgress
                    icon={<FatsIcon className="w-5 h-5 text-green-400" />}
                    name="Grasas"
                    actual={actual.fats}
                    target={currentTarget.fats}
                    color="green"
                />
            </div>
            <div>
                <CaloriesProgress
                    name="Calorías Totales"
                    actual={actual.calories}
                    target={currentTarget.calories}
                    color="orange"
                />
            </div>
        </div>
    );
};

export default MacroVisualizer;
