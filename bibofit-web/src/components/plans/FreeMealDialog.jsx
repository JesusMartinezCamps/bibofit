import React from 'react';
    import { Dialog, DialogContent } from '@/components/ui/dialog';
    import { useFreeMealDialog } from './hooks/useFreeMealDialog';
    import FreeMealDialogUI from './UI/FreeMealDialogUI';

    const FreeMealDialog = ({ open, onOpenChange, userId, onSaveSuccess, mealDate: initialMealDate, preselectedMealId, mealToEdit }) => {
      const {
        isSubmitting,
        name, setName,
        instructions, setInstructions,
        ingredients, setIngredients,
        dayMealId,
        mealDate,
        userRestrictions,
        availableFoods,
        conflictingIngredientsData,
        handleSubmit,
      } = useFreeMealDialog({ open, onOpenChange, userId, onSaveSuccess, initialMealDate, preselectedMealId, mealToEdit });

      const handleOpenChange = (isOpen) => {
        if (!isOpen) {
          onOpenChange(false);
        }
      };

      return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent 
            className="bg-[#0C101C] border-gray-700 text-white w-[95vw] max-w-2xl h-[calc(100vh-4rem)] flex flex-col p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex-1 overflow-y-auto styled-scrollbar-green pl-2 pr-0">
              <FreeMealDialogUI
                isSubmitting={isSubmitting}
                mealToEdit={mealToEdit}
                name={name}
                setName={setName}
                instructions={instructions}
                setInstructions={setInstructions}
                conflictingIngredientsData={conflictingIngredientsData}
                ingredients={ingredients}
                setIngredients={setIngredients}
                userRestrictions={userRestrictions}
                availableFoods={availableFoods}
                handleSubmit={handleSubmit}
              />
            </div>
          </DialogContent>
        </Dialog>
      );
    };

    export default FreeMealDialog;