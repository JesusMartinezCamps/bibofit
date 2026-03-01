import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFoodForm } from '@/components/admin/recipes/hooks/useFoodForm';
import CreateFoodForm from '@/components/admin/recipes/CreateFoodForm';
import { Loader2 } from 'lucide-react';

const FoodDetailModal = ({ food, isOpen, onClose, onActionComplete, allSensitivities, activeTab, onReject, onDelete }) => {
    if (!food) return null;
    
    const isPending = activeTab === 'pending';

    const handleFoodActionComplete = (updatedFood) => {
        onActionComplete(updatedFood || { ...food, status: 'approved_general' }, 'approved_general');
        onClose();
    };

    const handleRejectClick = () => {
        onReject(food.id);
        onClose();
    };

    const handleDeleteClick = () => {
        onDelete(food.id);
        onClose();
    };
    
    const foodToEdit = {
        ...food,
        id: food.id,
        // Map data from food to what CreateFoodForm expects
        food_to_food_groups: (food.food_to_food_groups || []).map(fg => ({ food_group_id: fg.food_group_id })),
        food_sensitivities: (food.food_sensitivities || []).map(s => ({ sensitivity_id: s.sensitivity_id })),
        food_vitamins: (food.food_vitamins || []).map(v => ({ vitamin_id: v.vitamin_id, mg_per_100g: v.mg_per_100g })),
        food_minerals: (food.food_minerals || []).map(m => ({ mineral_id: m.mineral_id, mg_per_100g: m.mg_per_100g })),
        total_fats: food.total_fats,
        total_carbs: food.total_carbs,
        food_to_stores: food.store_id ? [{ store_id: food.store_id }] : [],
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] bg-slate-900 border-slate-800 text-white flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-cyan-400">Detalle del Alimento Solicitado</DialogTitle>
                    <DialogDescription>
                        Revisa y aprueba el alimento solicitado por {food.user_full_name}.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-grow overflow-y-auto pr-2 styled-scrollbar-green">
                   <CreateFoodForm 
                        key={food.id}
                        foodToEdit={foodToEdit} 
                        onFoodActionComplete={handleFoodActionComplete}
                        isEditing={true} // It's like editing to create a new one
                        isClientRequest={true}
                        foodRequestData={food}
                    />
                </div>

                <DialogFooter className="mt-4 pt-4 border-t border-slate-700">
                    {isPending ? (
                        <>
                            <Button variant="destructive" onClick={handleRejectClick}>Rechazar</Button>
                        </>
                    ) : (
                       <Button variant="destructive" onClick={handleDeleteClick}>Eliminar</Button>
                    )}
                     <Button variant="ghost" onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FoodDetailModal;
