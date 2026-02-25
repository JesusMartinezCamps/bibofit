import React from 'react';
import { motion } from 'framer-motion';

const MacroProgress = ({ icon, name, actual, target, color }) => {
    const safeActual = isNaN(actual) ? 0 : actual;
    const safeTarget = isNaN(target) || target === 0 ? 1 : target; // Avoid division by zero
    
    const rawPercentage = (safeActual / safeTarget) * 100;
    
    let displayPercentage;
    if (rawPercentage > 100 && rawPercentage < 106) {
        displayPercentage = 100;
    } else {
        displayPercentage = rawPercentage;
    }
    
    const barPercentage = Math.min(rawPercentage, 100);

    const colorMap = {
        red: {
            text: 'text-red-400',
            gradientFrom: 'from-red-500',
            gradientTo: 'to-red-400',
        },
        yellow: {
            text: 'text-yellow-400',
            gradientFrom: 'from-yellow-500',
            gradientTo: 'to-yellow-400',
        },
        green: {
            text: 'text-green-400',
            gradientFrom: 'from-green-500',
            gradientTo: 'to-green-400',
        },
    };

    const c = colorMap[color] || colorMap.red;

    return (
        <div className="flex flex-col items-center justify-between space-y-2 py-1 px-2 sm:px-4">
            <div className="flex items-center space-x-2">
                {icon}
                <span className={`font-semibold ${c.text}`}>{name}</span>
            </div>
            
            <div className="w-full text-center">
                <span className="text-xl font-bold text-white tabular-nums">{Math.round(safeActual)}</span>
                <span className="text-sm text-gray-400">g / {Math.round(safeTarget)}g</span>
            </div>

            <div className="w-full">
                <div className="relative h-5 w-full bg-gray-700/50 rounded-full overflow-hidden flex items-center justify-center">
                    <motion.div
                        className={`absolute top-0 left-0 h-full bg-gradient-to-r ${c.gradientFrom} ${c.gradientTo} rounded-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${barPercentage}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                    <span className="relative text-xs font-bold text-white z-10 drop-shadow-sm">
                        {Math.round(displayPercentage)}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default MacroProgress;