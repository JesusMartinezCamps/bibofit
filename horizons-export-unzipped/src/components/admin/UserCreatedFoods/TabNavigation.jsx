import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const TabNavigation = ({ tabs, activeTab, onTabChange, pendingCount }) => {
  return (
    <div className="mb-6 border-b border-gray-700">
      <nav className="-mb-px flex space-x-6" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              'relative whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === tab.value
                ? 'border-green-400 text-green-300'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
            )}
          >
            <div className="flex items-center gap-2">
              <span>{tab.label}</span>
              {tab.value === 'pending' && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </div>
            {activeTab === tab.value && (
              <motion.div
                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-green-400"
                layoutId="underline"
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default TabNavigation;