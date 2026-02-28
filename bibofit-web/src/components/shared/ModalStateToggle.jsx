import React from 'react';
    import { motion } from 'framer-motion';
    import { Switch } from '@/components/ui/switch';
    import { X, Apple } from 'lucide-react';
    import { cn } from '@/lib/utils';
    import { Button } from '@/components/ui/button';
    import { Link, useNavigate } from 'react-router-dom';
    import {
      Tooltip,
      TooltipContent,
      TooltipTrigger,
    } from "@/components/ui/tooltip";

    const ModalStateToggle = ({
      mode,
      onModeChange,
      loading,
      onClose,
      className,
      optionOne,
      optionTwo,
      fromHeader,
    }) => {
      const navigate = useNavigate();
      const isOptionTwoActive = mode === optionTwo.value;

      const IconOne = optionOne.icon;
      const IconTwo = optionTwo.icon;

      const handleLabelClick = (targetMode) => {
        if (loading) return;
        if (targetMode === optionOne.value && isOptionTwoActive) {
          onModeChange(false);
        } else if (targetMode === optionTwo.value && !isOptionTwoActive) {
          onModeChange(true);
        }
      };

      const handleDietPlanClick = (e) => {
        e.preventDefault();
        if (onClose) {
          onClose();
        }
        navigate('/plan/dieta');
      };

      return (
        <motion.div
          key="modal-state-toggle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={cn(
            `relative flex justify-between items-center px-4 py-3 transition-colors duration-300 w-full`,
            isOptionTwoActive ? 'bg-cyan-800/30' : 'bg-gray-800/50',
            className
          )}
        >
          {fromHeader && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDietPlanClick}
                  className="h-8 w-8 rounded-full text-[#efffff] hover:text-white hover:bg-gray-200/20 absolute left-4 top-1/2 -translate-y-1/2"
                >
                  <Apple className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ir al Plan de Dieta</p>
              </TooltipContent>
            </Tooltip>
          )}

          <div className="flex-1 flex justify-center">
            <div className="flex items-center space-x-3">
              <div 
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => handleLabelClick(optionOne.value)}
              >
                <IconOne className={cn('h-5 w-5 transition-colors', !isOptionTwoActive ? 'text-white' : 'text-gray-400')} />
                <span className={cn('font-semibold transition-colors', !isOptionTwoActive ? 'text-white' : 'text-gray-400')}>{optionOne.label}</span>
              </div>
              <Switch
                checked={isOptionTwoActive}
                onCheckedChange={onModeChange}
                id="modal-state-toggle"
                className="data-[state=checked]:bg-cyan-300 data-[state=unchecked]:bg-gray-600"
                disabled={loading}
              />
              <div 
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => handleLabelClick(optionTwo.value)}
              >
                <IconTwo className={cn('h-5 w-5 transition-colors', isOptionTwoActive ? 'text-white' : 'text-gray-400')} />
                <span className={cn('font-semibold transition-colors', isOptionTwoActive ? 'text-white' : 'text-gray-400')}>{optionTwo.label}</span>
              </div>
            </div>
          </div>
        </motion.div>
      );
    };

    export default ModalStateToggle;