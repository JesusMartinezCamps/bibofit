import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const TabNavigation = ({ tabs, activeTab, onTabChange, pendingCount, usersWithPending }) => {
  const normalizedTabs = (tabs || []).map((tab) => ({
    value: tab.value ?? tab.id,
    label: tab.label ?? tab.name,
  }));
  const legacyPendingCount = Array.isArray(usersWithPending)
    ? usersWithPending.reduce((acc, item) => acc + (item?.count || 0), 0)
    : 0;
  const pendingBadgeCount = pendingCount ?? legacyPendingCount;

  return (
    <div className="mb-6 border-b border-border">
      <nav className="-mb-px flex space-x-6" aria-label="Tabs">
        {normalizedTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              'relative whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === tab.value
                ? 'border-green-400 text-green-300'
                : 'border-transparent text-muted-foreground hover:text-gray-200 hover:border-gray-500'
            )}
          >
            <div className="flex items-center gap-2">
              <span>{tab.label}</span>
              {tab.value === 'pending' && pendingBadgeCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingBadgeCount}
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
