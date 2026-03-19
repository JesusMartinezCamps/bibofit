import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Repeat } from 'lucide-react';
import { useContextualGuide } from '@/contexts/ContextualGuideContext';
import { GUIDE_BLOCK_IDS } from '@/config/guideBlocks';

const SnackSelectorDialog = ({ open, onOpenChange, onAddNew, onRepeat }) => {
  const { triggerBlock } = useContextualGuide();

  useEffect(() => {
    if (open) triggerBlock(GUIDE_BLOCK_IDS.SNACK_SELECTOR);
  }, [open, triggerBlock]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Añadir Picoteo</DialogTitle>
          <DialogDescription className="text-center">
            ¿Quieres crear un picoteo nuevo o repetir uno que ya has comido?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <button
            onClick={onAddNew}
            className="group relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-green-500/50 bg-gradient-to-br from-green-500/90 dark:from-green-500/40 to-green-900/50 dark:to-green-900/20 text-white transition-all duration-300 hover:border-green-400 hover:scale-105"
          >
            <Plus className="h-12 w-12 mb-3 text-[rgb(74_222_128)] transition-transform duration-300 group-hover:scale-110" />
            <span className="text-lg font-semibold">Añadir Picoteo</span>
            <span className="text-sm text-white">Crea un picoteo nuevo</span>
          </button>
          <button
            onClick={onRepeat}
            className="group relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/90 dark:from-amber-500/40 to-amber-900/50 dark:to-amber-900/20 text-white transition-all duration-300 hover:border-amber-400 hover:scale-105"
          >
            <Repeat className="h-12 w-12 mb-3 text-amber-400 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-lg font-semibold">Repetir un Picoteo</span>
            <span className="text-sm text-white">Elige uno que ya comiste</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SnackSelectorDialog;