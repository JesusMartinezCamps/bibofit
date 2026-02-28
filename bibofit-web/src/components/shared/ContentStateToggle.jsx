import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const ContentStateToggle = ({
  mode,
  onModeChange,
  loading,
  className,
  optionOne,
  optionTwo,
  isSegmented = false,
}) => {
  const IconOne = optionOne.icon;
  const IconTwo = optionTwo.icon;

  if (isSegmented) {
    return (
      <div className={cn("grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-800 border border-slate-700", className)}>
        <button
          onClick={() => onModeChange(optionOne.value)}
          disabled={loading}
          className={cn(
            "flex items-center justify-center gap-2 p-2 rounded-md transition-colors text-sm font-semibold",
            mode === optionOne.value ? 'bg-slate-700 text-white' : 'text-gray-400 hover:bg-slate-700/50'
          )}
        >
          <IconOne className="h-4 w-4" />
          <span>{optionOne.label}</span>
        </button>
        <button
          onClick={() => onModeChange(optionTwo.value)}
          disabled={loading}
          className={cn(
            "flex items-center justify-center gap-2 p-2 rounded-md transition-colors text-sm font-semibold",
            mode === optionTwo.value ? 'bg-slate-700 text-white' : 'text-gray-400 hover:bg-slate-700/50'
          )}
        >
          <IconTwo className="h-4 w-4" />
          <span>{optionTwo.label}</span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      key="content-state-toggle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        `relative flex items-center p-1 rounded-lg gap-2 border border-slate-700 bg-slate-800`,
        className
      )}
    >
      <button
        onClick={() => onModeChange(optionOne.value)}
        disabled={loading}
        className={cn(
          "flex items-center gap-2 p-2 rounded-md transition-colors relative z-10",
          mode === optionOne.value ? 'text-white' : 'text-gray-400'
        )}
      >
        <IconOne className="h-4 w-4" />
        <span className="font-semibold hidden sm:inline">{optionOne.label}</span>
      </button>
      <button
        onClick={() => onModeChange(optionTwo.value)}
        disabled={loading}
        className={cn(
          "flex items-center gap-2 p-2 rounded-md transition-colors relative z-10",
          mode === optionTwo.value ? 'text-white' : 'text-gray-400'
        )}
      >
        <IconTwo className="h-4 w-4" />
        <span className="font-semibold hidden sm:inline">{optionTwo.label}</span>
      </button>
      <motion.div
        className="absolute top-1 bottom-1 bg-slate-700 rounded-md z-0"
        initial={false}
        animate={{
          x: mode === optionOne.value ? '0%' : '100%',
          width: mode === optionOne.value ? '50%' : '50%',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          left: '2px',
          right: '2px',
          width: 'calc(50% - 4px)',
          transform: `translateX(${mode === optionOne.value ? '0%' : '100%'})`,
        }}
      />
    </motion.div>
  );
};

export default ContentStateToggle;