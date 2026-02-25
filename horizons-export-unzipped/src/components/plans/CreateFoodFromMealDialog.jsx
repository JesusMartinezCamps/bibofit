import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SimplifiedFoodForm from '@/components/admin/recipes/SimplifiedFoodForm';
import { useAuth } from '@/contexts/AuthContext';

const CreateFoodFromMealDialog = ({ open, onOpenChange, onFoodCreated, foodToCreate }) => {
  const { user } = useAuth();

  const handleFoodCreated = (newFood) => {
    onFoodCreated(newFood);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0C101C] border-gray-700 text-white w-[95vw] max-w-2xl h-auto max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Añadir Nuevo Alimento</DialogTitle>
          <DialogDescription>
            Introduce los detalles del nuevo alimento. Una vez guardado, podrás usarlo en tus comidas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto styled-scrollbar-green px-6 pb-6">
          <SimplifiedFoodForm 
            onFoodActionComplete={handleFoodCreated} 
            isClientRequest={true}
            userId={user?.id}
            foodToCreate={foodToCreate}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFoodFromMealDialog;