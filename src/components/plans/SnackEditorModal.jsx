import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { calculateMacros } from '@/lib/macroCalculator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Scale, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';

const SnackEditorModal = ({ open, onOpenChange, snackToEdit, onOpenEquivalence, onDeleteFromLog, onDeletePermanent, allFoods: allAvailableFoods }) => {
    const { toast } = useToast();
  const [ingredients, setIngredients] = useState([]);
  const [snackData, setSnackData] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sourceLogId, setSourceLogId] = useState(null);

  const fetchInitialData = useCallback(async () => {
    if (open && snackToEdit) {
      setSnackData(snackToEdit);
      const mappedIngredients = snackToEdit.snack_ingredients.map(ing => {
        const food = ing.food || ing.user_created_food;
        return {
          food_id: food?.id,
          food_name: food?.name || 'Ingrediente Desconocido',
          quantity: ing.grams,
          food_unit: food?.food_unit || 'gramos',
          is_user_created: !!ing.user_created_food_id,
          food: food // Attach the full food object
        };
      });
      setIngredients(mappedIngredients);
      
      const { data: logData, error: logError } = await supabase
        .from('daily_snack_logs')
        .select('id')
        .eq('snack_occurrence_id', snackToEdit.occurrence_id)
        .maybeSingle();
      
      if (logError) {
          console.error("Error fetching snack log:", logError.message);
          setSourceLogId(null);
      } else if (logData) {
        setSourceLogId(logData.id);
      } else {
        setSourceLogId(null);
      }
    } else {
      setSourceLogId(null);
    }
  }, [open, snackToEdit]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const macros = useMemo(() => {
    if (!ingredients.length || !allAvailableFoods?.length) return { calories: 0, proteins: 0, carbs: 0, fats: 0 };
    return calculateMacros(ingredients, allAvailableFoods);
  }, [ingredients, allAvailableFoods]);

  const handleEquivalenceClick = () => {
    if (!sourceLogId) {
        toast({
            title: 'Acción no disponible',
            description: 'Debes marcar el snack como comido para poder aplicar una equivalencia.',
            variant: 'default',
        });
    } else if (onOpenEquivalence) {
        onOpenEquivalence({
            item: snackData,
            type: 'snack',
            macros,
            logId: sourceLogId,
        });
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (snackToEdit && onDeleteFromLog) {
        await onDeleteFromLog(snackToEdit.occurrence_id);
        onOpenChange(false);
    }
  };

  return (
    <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#0C101C] border-gray-700 text-white w-[95vw] max-w-2xl flex flex-col p-0">
                <div className="flex-1 overflow-hidden p-6">
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 overflow-y-auto styled-scrollbar-orange h-full">
                        <DialogHeader>
                            <div className="flex justify-between items-center">
                                <DialogTitle className="text-2xl bg-gradient-to-r from-[#f78323] to-[#f5db24] text-transparent bg-clip-text">{snackData?.name}</DialogTitle>
                                <div style={{ marginRight: '5%' }}>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={handleEquivalenceClick} className="text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 border border-[#70a3f3] h-8 w-8 disabled:opacity-50 disabled:cursor-not-allowed" style={{borderWidth: 'thin'}} disabled={!sourceLogId}>
                                                    <Scale className="h-5 w-5" />
                                                </Button>
                                            </TooltipTrigger>
                                            {!sourceLogId && (
                                                <TooltipContent>
                                                    <p>Marca el snack como comido para activar la equivalencia.</p>
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </DialogHeader>
                        <div>
                            <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-[#f78323] to-[#f5db24] text-transparent bg-clip-text">Ingredientes</h3>
                            <ul className="space-y-1 text-gray-300">
                            {ingredients.map((ing, index) => (
                                <li key={index} className="flex justify-between">
                                <span>{ing.food_name}</span>
                                <span>{ing.quantity}{ing.food_unit === 'unidades' ? 'ud' : 'g'}</span>
                                </li>
                            ))}
                            </ul>
                        </div>
                        <div className="border-t border-gray-700 pt-4">
                                <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-[#f78323] to-[#f5db24] text-transparent bg-clip-text">Macros Estimados</h3>
                                <div className="flex justify-around text-center">
                                    <div>
                                        <p className="text-2xl font-bold text-amber-400">{Math.round(macros.calories)}</p>
                                        <p className="text-xs text-gray-400">Kcal</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-red-400">{Math.round(macros.proteins)}g</p>
                                        <p className="text-xs text-gray-400">Proteínas</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-yellow-400">{Math.round(macros.carbs)}g</p>
                                        <p className="text-xs text-gray-400">Carbs</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-green-400">{Math.round(macros.fats)}g</p>
                                        <p className="text-xs text-gray-400">Grasas</p>
                                    </div>
                                </div>
                            </div>
                    </motion.div>
                </div>
                 <div className="px-6 pb-4 mt-auto border-t border-gray-700 pt-4">
                    <Button
                        variant="destructive"
                        className="w-full text-red-400 border border-red-500/50 hover:bg-red-800/50"
                        style={{ backgroundColor: 'rgb(153 27 27 / 12%)' }}
                        onClick={handleDeleteClick}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar Picoteo del día
                    </Button>
                </div>
            </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción eliminará el picoteo de la planificación de este día. Podrás volver a añadirlo más tarde desde la lista de picoteos.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                        Eliminar del día
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </>
  );
};

export default SnackEditorModal;