import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ConflictNotification = ({ conflicts }) => {
    if (!conflicts || conflicts.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="p-3 mb-4 border border-orange-500/30 rounded-lg bg-orange-500/10 flex items-start gap-3 overflow-hidden"
            >
                <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-orange-300">
                        Conflicto de Restricciones Detectado
                    </p>
                    <p className="text-xs text-orange-400">
                        Esta receta contiene ingredientes que no son aptos según las restricciones del plan:
                    </p>
                    <ul className="list-disc list-inside text-xs text-orange-400 mt-1">
                        {conflicts.map(conflict => (
                             <li key={`${conflict.foodName}-${conflict.restrictionName}`}>
                                <span className={cn("font-semibold", conflict.type === 'condition_avoid' ? "text-red-400" : "text-orange-400")}>{conflict.foodName}</span>
                                <span className="text-gray-400"> ({conflict.restrictionName})</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ConflictNotification;