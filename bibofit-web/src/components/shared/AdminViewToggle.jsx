import React from 'react';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Eye, Settings, X, Save, ScanSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import * as DialogPrimitive from "@radix-ui/react-dialog";

const ViewModeToggle = ({ mode, onModeChange, loading, onClose, className, hasChanges, isClientRequestView = false, showClose = true, switchCheckedColor = 'data-[state=checked]:bg-violet-500', activeIconColor = 'text-violet-500', leftElement = null, switchDisabled = false, saveLabel = 'Guardar', showSaveIndicator = true }) => {
  const isViewMode = mode === 'view';
  const showSaveHint = showSaveIndicator && !isViewMode && hasChanges;
  const isToggleDisabled = loading || switchDisabled;

  const SettingsIcon = isClientRequestView ? ScanSearch : Settings;
  const ViewIcon = showSaveIndicator && !isViewMode && hasChanges ? Save : Eye;
  const handleToggleAreaClick = () => {
    if (isToggleDisabled) return;
    onModeChange(!isViewMode);
  };

  return (
    <motion.div
      key="view-mode-toggle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        `relative flex justify-between items-center px-4 py-3 transition-colors duration-300 w-full`,
        isViewMode ? 'bg-gray-300/10' : 'bg-muted/65', // Adjusted background color for view mode
        className
      )}
    >
      {leftElement && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          {leftElement}
        </div>
      )}
      <div className="flex-1 flex justify-center">
        <div
          role="button"
          tabIndex={isToggleDisabled ? -1 : 0}
          aria-disabled={isToggleDisabled}
          onClick={handleToggleAreaClick}
          onKeyDown={(e) => {
            if (isToggleDisabled) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onModeChange(!isViewMode);
            }
          }}
          className={cn(
            'flex items-center space-x-3 rounded-md px-3 py-2 -mx-3 -my-2 transition-colors',
            isToggleDisabled
              ? 'cursor-not-allowed opacity-70'
              : 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40'
          )}
        >
          <SettingsIcon className={`h-5 w-5 transition-colors ${!isViewMode ? activeIconColor : 'text-muted-foreground'}`} />
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={isViewMode}
              onCheckedChange={onModeChange}
              id="view-mode-toggle"
              className={cn(switchCheckedColor, 'data-[state=unchecked]:bg-gray-600')}
              disabled={isToggleDisabled}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <ViewIcon className={`h-5 w-5 transition-colors ${isViewMode || (!isViewMode && hasChanges) ? activeIconColor : 'text-muted-foreground'}`} />
            {showSaveHint && (
              <span className={cn('text-sm font-semibold', activeIconColor)}>
                {saveLabel}
              </span>
            )}
          </div>
        </div>
      </div>
      {showClose && onClose && (
        <DialogPrimitive.Close asChild>
            <Button
            variant="ghost"
            size="icon"
            className={cn(
                'h-8 w-8 rounded-full transition-colors absolute right-4 top-1/2 -translate-y-1/2',
                isViewMode ? 'text-muted-foreground hover:text-foreground hover:bg-white/10' : 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
            )}
            >
            <X className="h-5 w-5" />
            </Button>
        </DialogPrimitive.Close>
      )}
    </motion.div>
  );
};

export default ViewModeToggle;
