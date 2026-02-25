import React from 'react';
import { motion } from 'framer-motion';
import CaloriesIcon from '@/components/icons/CaloriesIcon';

const CaloriesProgress = ({ name, actual, target, color }) => {
    const safeActual = isNaN(actual) ? 0 : actual;
    const safeTarget = isNaN(target) || target === 0 ? 1 : target; // Avoid division by zero
    const percentage = Math.min((safeActual / safeTarget) * 100, 100);

    const colorMap = {
        orange: {
            text: 'text-orange-400',
            gradientFrom: 'from-orange-600',
            gradientTo: 'to-orange-400',
        }
    };

    const c = colorMap[color] || colorMap.orange;

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center space-x-2">
                    <CaloriesIcon className={`w-6 h-6 ${c.text}`} />
                    <span className={`font-semibold ${c.text}`}>{name}</span>
                </div>
                <div>
                    <span className="text-lg font-bold text-white tabular-nums w-[5ch] inline-block text-right">{Math.round(safeActual)}</span>
                    <span className="text-sm text-gray-400"> / {Math.round(safeTarget)} kcal</span>
                </div>
            </div>
            <div className="relative h-5 w-full bg-gray-700/50 rounded-full overflow-hidden flex items-center justify-center">
                <motion.div
                    className={`absolute top-0 left-0 h-full bg-gradient-to-r ${c.gradientFrom} ${c.gradientTo} rounded-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                />
                <span className="relative text-xs font-bold text-white z-10 drop-shadow-sm">
                    {Math.round(percentage)}%
                </span>
            </div>
        </div>
    );
};

export default CaloriesProgress;