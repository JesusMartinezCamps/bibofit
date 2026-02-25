import React from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Plus, Repeat } from 'lucide-react';

    const FreeMealSelectorDialog = ({ open, onOpenChange, onAddNew, onRepeat }) => {
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="bg-[#1a1e23] border-gray-700 text-white sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">Gestionar Receta Libre</DialogTitle>
              <DialogDescription className="text-center">
                ¿Quieres crear una receta nueva desde cero o repetir una que ya has hecho?
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <button
                onClick={onAddNew}
                className="group relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-green-500/50 bg-gradient-to-br from-green-900/50 to-gray-900/30 text-white transition-all duration-300 hover:border-green-400 hover:scale-105"
              >
                <Plus className="h-12 w-12 mb-3 text-green-400 transition-transform duration-300 group-hover:scale-110" />
                <span className="text-lg font-semibold">Crear nueva Receta</span>
                <span className="text-sm text-gray-400">Crea una nueva receta tu gusto</span>
              </button>
              <button
                onClick={onRepeat}
                className="group relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-blue-500/50 bg-gradient-to-br from-blue-900/50 to-gray-900/30 text-white transition-all duration-300 hover:border-blue-400 hover:scale-105"
              >
                <Repeat className="h-12 w-12 mb-3 text-blue-400 transition-transform duration-300 group-hover:scale-110" />
                <span className="text-lg font-semibold">Seleccionar una Receta</span>
                <span className="text-sm text-gray-400">Elige entre las recetas de la app o entre las que tú ya has creado</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      );
    };

    export default FreeMealSelectorDialog;