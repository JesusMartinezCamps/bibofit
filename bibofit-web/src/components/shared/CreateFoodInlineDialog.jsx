import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SimplifiedFoodForm from '@/components/admin/recipes/SimplifiedFoodForm';

const CreateFoodInlineDialog = ({
  open,
  onOpenChange,
  userId,
  foodToCreate,
  onFoodCreated,
  description = 'Introduce los detalles del alimento para poder usarlo de inmediato.',
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0C101C] border-gray-700 text-white w-[95vw] max-w-2xl h-auto max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Añadir Nuevo Alimento</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto styled-scrollbar-green px-6 pb-6">
          <SimplifiedFoodForm
            onFoodActionComplete={onFoodCreated}
            isClientRequest={true}
            userId={userId}
            foodToCreate={foodToCreate}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFoodInlineDialog;
