import React from 'react';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Eye, Settings, X, Save, Pen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import * as DialogPrimitive from "@radix-ui/react-dialog";

const ViewModeToggle = ({ mode, onModeChange, loading, onClose, className, hasChanges, isClientRequestView = false, showClose = true, switchCheckedColor = 'data-[state=checked]:bg-violet-500', activeIconColor = 'text-violet-500' }) => {
  const isViewMode = mode === 'view';
  
  const SettingsIcon = isClientRequestView ? Pen : Settings;
  const ViewIcon = !isViewMode && hasChanges ? Save : Eye;

  return (
    <motion.div
      key="view-mode-toggle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        `relative flex justify-between items-center px-4 py-3 transition-colors duration-300 w-full`,
        isViewMode ? 'bg-sky-900/30' : 'bg-gray-800/50', // Adjusted background color for view mode
        className
      )}
    >
      <div className="flex-1 flex justify-center">
        <div className="flex items-center space-x-3">
          <SettingsIcon className={`h-5 w-5 transition-colors ${!isViewMode ? activeIconColor : 'text-gray-400'}`} />
          <Switch
            checked={isViewMode}
            onCheckedChange={onModeChange}
            id="view-mode-toggle"
            className={cn(switchCheckedColor, 'data-[state=unchecked]:bg-gray-600')} // Dynamic switch color
            disabled={loading}
          />
          <ViewIcon className={`h-5 w-5 transition-colors ${isViewMode || (!isViewMode && hasChanges) ? activeIconColor : 'text-gray-400'}`} />
        </div>
      </div>
      {showClose && onClose && (
        <DialogPrimitive.Close asChild>
            <Button
            variant="ghost"
            size="icon"
            className={cn(
                'h-8 w-8 rounded-full transition-colors absolute right-4 top-1/2 -translate-y-1/2',
                isViewMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
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