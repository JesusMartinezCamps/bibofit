import React from 'react';
import { cn } from '@/lib/utils';

const FormBlock = ({ title, icon: Icon, color, children }) => {
  const colorClasses = {
    green: 'from-green-500 to-emerald-600',
    yellow: 'from-yellow-400 to-amber-500',
    'orange-red': 'from-orange-500 to-red-600',
    'green-red': 'from-green-500 to-red-600',
    purple: 'from-purple-500 to-indigo-600',
    red: 'from-red-500 to-orange-500',
  };

  const gradientClass = colorClasses[color] || 'from-gray-500 to-gray-600';

  return (
    <div className="bg-gray-800/30 rounded-xl overflow-hidden border border-gray-700/50">
      <div className={`h-1.5 bg-gradient-to-r ${gradientClass}`}></div>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          {Icon && <Icon className="w-6 h-6 text-gray-300" />}
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FormBlock;