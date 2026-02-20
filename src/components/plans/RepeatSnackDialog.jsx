import React, { useState, useEffect } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
    import { Apple, ArrowLeft, Calendar, Loader2, X } from 'lucide-react';
    import { formatDistanceToNow, parseISO } from 'date-fns';
    import { es } from 'date-fns/locale';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

    const RepeatSnackDialog = ({ open, onOpenChange, onSelectSnack, planId, userId, allFoods, onDeleteSnack, onBack}) => {
      const [loading, setLoading] = useState(true);
      const [snacks, setSnacks] = useState([]);
      const [snackToDelete, setSnackToDelete] = useState(null);
      const [isConfirmOpen, setIsConfirmOpen] = useState(false);

      useEffect(() => {
        const fetchSnacks = async () => {
          if (!open || !planId || !userId) return;
          setLoading(true);
          try {
            const { data, error } = await supabase
              .from('snacks')
              .select('*, snack_ingredients(*, food(*), user_created_food:user_created_foods(*)), occurrences:snack_occurrences(meal_date)')
              .eq('diet_plan_id', planId)
              .eq('user_id', userId);
            
            if (error) throw error;

            const processedSnacks = data.map(snack => {
              const latestOccurrence = snack.occurrences.length > 0 
                ? snack.occurrences.reduce((latest, current) => new Date(current.meal_date) > new Date(latest.meal_date) ? current : latest)
                : null;
              return { ...snack, last_used: latestOccurrence?.meal_date };
            });

            setSnacks(processedSnacks);
          } catch (error) {
            console.error("Error fetching snacks:", error);
          } finally {
            setLoading(false);
          }
        };

        if (open) {
          fetchSnacks();
        }
      }, [open, planId, userId]);

      const handleSelect = (snack) => {
        onSelectSnack(snack);
        onOpenChange(false);
      };
       const handleBack = () => {
        if (onBack) {
          onBack();
          return;
        }

        onOpenChange(false);
      };
      const handleDeleteClick = (e, snack) => {
        e.stopPropagation();
        setSnackToDelete(snack);
        setIsConfirmOpen(true);
      };

      const confirmDelete = async () => {
        if (snackToDelete) {
          const success = await onDeleteSnack(snackToDelete.id);
          if (success) {
            setSnacks(prev => prev.filter(s => s.id !== snackToDelete.id));
          }
        }
        setIsConfirmOpen(false);
        setSnackToDelete(null);
      };

      const getIngredientList = (ingredients) => {
        if (!ingredients || ingredients.length === 0) return 'Sin ingredientes.';
        return ingredients.map(ing => {
          const foodDetails = ing.food || ing.user_created_food;
          const unit = foodDetails?.food_unit === 'unidades' ? 'ud' : 'g';
          const quantity = ing.grams ?? ing.quantity;
          return `${foodDetails?.name || 'Ingrediente desconocido'} (${Math.round(quantity || 0)}${unit})`;
        }).join(', ');
      };

      const getLastEatenDate = (mealDate) => {
        if (!mealDate) return null;
        try {
          const date = parseISO(mealDate);
          return formatDistanceToNow(date, { addSuffix: true, locale: es });
        } catch (error) {
          return null;
        }
      };

      return (
        <>
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1a1e23] border-gray-700 text-white sm:max-w-md p-0 sm:p-0">
              <div className="p-6 pb-2">
                <DialogHeader>
                <button
                    onClick={handleBack}
                    className="absolute left-6 top-6 inline-flex items-center justify-center rounded-full p-2 text-gray-300 transition-colors hover:bg-gray-700/80 hover:text-white"
                    aria-label="Volver al selector de picoteos"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <DialogTitle className="text-center text-2xl">Repetir un Picoteo</DialogTitle>
                  <DialogDescription className="text-center">
                    Selecciona uno de tus picoteos guardados para añadirlo al día de hoy.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <ScrollArea className="h-96 w-full rounded-md p-6 pt-2" type="always">
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {snacks.length > 0 ? (
                      snacks.map(snack => {
                        const lastEaten = getLastEatenDate(snack.last_used);
                        return (
                          <div key={snack.id} className="relative group">
                            <button
                              onClick={() => handleSelect(snack)}
                              className="w-full text-left p-4 rounded-lg bg-gray-800/60 hover:bg-gray-700/80 transition-colors flex flex-col gap-3 border border-gray-700/50"
                            >
                              {lastEaten && (
                                <div className="flex items-center text-xs text-gray-400">
                                  <Calendar className="w-3 h-3 mr-1.5" />
                                  {lastEaten}
                                </div>
                              )}
                              <div className="flex items-center gap-3">
                                <Apple className="h-5 w-5 text-orange-400 flex-shrink-0" />
                                <p className="font-semibold text-lg">{snack.name}</p>
                              </div>
                              <div className="text-xs text-gray-500 border-t border-gray-700/50 pt-2 mt-2">
                                <p className="line-clamp-3">{getIngredientList(snack.snack_ingredients)}</p>
                              </div>
                            </button>
                             <button 
                                onClick={(e) => handleDeleteClick(e, snack)}
                                className="absolute top-2 right-2 bg-red-500/70 text-white rounded-full p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-red-500"
                                title="Eliminar picoteo permanentemente"
                              >
                                <X className="w-4 h-4" />
                              </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500 italic py-10">
                        <Apple className="h-10 w-10 mb-4 text-gray-600" />
                        No has creado ningún picoteo en este plan todavía.
                      </div>
                    )}
                  </div>
                )}
                <ScrollBar orientation="vertical" className="[&>div]:bg-orange-500" />
              </ScrollArea>
            </DialogContent>
          </Dialog>
          <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará el picoteo "{snackToDelete?.name}" y todas sus apariciones en el plan de forma permanente. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsConfirmOpen(false)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                  Eliminar Permanentemente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    };

    export default RepeatSnackDialog;