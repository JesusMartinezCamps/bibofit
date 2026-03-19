import React, { useEffect } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Plus, Repeat } from 'lucide-react';
    import { useContextualGuide } from '@/contexts/ContextualGuideContext';
    import { GUIDE_BLOCK_IDS } from '@/config/guideBlocks';

    const FreeRecipeSelectorDialog = ({ open, onOpenChange, onAddNew, onRepeat }) => {
      const { triggerBlock } = useContextualGuide();

      useEffect(() => {
        if (open) triggerBlock(GUIDE_BLOCK_IDS.FREE_RECIPE_SELECTOR);
      }, [open, triggerBlock]);

      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="bg-background border-border text-white sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">Gestionar Receta Libre</DialogTitle>
              <DialogDescription className="text-center">
                ¿Quieres Crear una receta nueva desde cero o Elegir entre alguna que ya está creada?
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <button
                onClick={onAddNew}
                className="group relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-green-500/50 bg-gradient-to-br from-green-500/90 dark:from-green-500/40 to-green-900/50 dark:to-green-900/20 text-white transition-all duration-300 hover:border-green-400 hover:scale-105"
              >
                <Plus className="h-12 w-12 mb-3 text-green-600 transition-transform duration-300 group-hover:scale-110" />
                <span className="text-lg text-white font-semibold">Crear nueva Receta</span>
                <span className="text-sm text-white ">Crea una nueva receta a tu gusto</span>
              </button>
              <button
                onClick={onRepeat}
                className="group relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-blue-500/50 bg-gradient-to-br from-blue-500/90 dark:from-blue-500/40 to-blue-900/50 dark:to-blue-900/20 text-white transition-all duration-300 hover:border-blue-400 hover:scale-105"
              >
                <Repeat className="h-12 w-12 mb-3 text-blue-600 transition-transform duration-300 group-hover:scale-110" />
                <span className="text-lg font-semibold">Elegir una Receta existente</span>
                <span className="text-sm text-white">Elige una receta de la app o alguna que ya hiciste</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      );
    };

    export default FreeRecipeSelectorDialog;