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
      <div className={cn("grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted border border-border", className)}>
        <button
          onClick={() => onModeChange(optionOne.value)}
          disabled={loading}
          className={cn(
            "flex items-center justify-center gap-2 p-2 rounded-md transition-colors text-sm font-semibold",
            mode === optionOne.value
              ? 'bg-cyan-300/30 dark:bg-cyan-300/10 text-cyan-600 border border-cyan-300/35'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
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
            mode === optionTwo.value
              ? 'bg-cyan-300/30 dark:bg-cyan-300/10 text-cyan-600 border border-cyan-300/35'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
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
        `relative flex items-center p-1 rounded-lg gap-2 border border-border bg-muted`,
        className
      )}
    >
      <button
        onClick={() => onModeChange(optionOne.value)}
        disabled={loading}
        className={cn(
          "flex items-center gap-2 p-2 rounded-md transition-colors relative z-10",
          mode === optionOne.value ? 'text-foreground' : 'text-muted-foreground'
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
          mode === optionTwo.value ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        <IconTwo className="h-4 w-4" />
        <span className="font-semibold hidden sm:inline">{optionTwo.label}</span>
      </button>
      <motion.div
        className="absolute top-1 bottom-1 bg-primary/20 border border-primary/35 rounded-md z-0"
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
