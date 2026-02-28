import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Repeat } from 'lucide-react';

const SnackSelectorDialog = ({ open, onOpenChange, onAddNew, onRepeat }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1e23] border-gray-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Añadir Picoteo</DialogTitle>
          <DialogDescription className="text-center">
            ¿Quieres crear un picoteo nuevo o repetir uno que ya has comido?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <button
            onClick={onAddNew}
            className="group relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-[rgb(34_197_94_/_50%)] bg-gradient-to-br from-[rgb(20_83_45_/_50%)] to-[rgb(17_24_39_/_30%)] text-white transition-all duration-300 hover:border-[rgb(34_197_94)] hover:scale-105"
          >
            <Plus className="h-12 w-12 mb-3 text-[rgb(74_222_128)] transition-transform duration-300 group-hover:scale-110" />
            <span className="text-lg font-semibold">Añadir Picoteo</span>
            <span className="text-sm text-gray-400">Crea un picoteo nuevo</span>
          </button>
          <button
            onClick={onRepeat}
            className="group relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-amber-500/50 bg-gradient-to-br from-amber-900/50 to-gray-900/30 text-white transition-all duration-300 hover:border-amber-400 hover:scale-105"
          >
            <Repeat className="h-12 w-12 mb-3 text-amber-400 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-lg font-semibold">Repetir un Picoteo</span>
            <span className="text-sm text-gray-400">Elige uno que ya comiste</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SnackSelectorDialog;