import React from 'react';
    import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Label } from '@/components/ui/label';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Loader2, AlertTriangle } from 'lucide-react';
    import { cn } from '@/lib/utils';
    import IngredientSearch from '@/components/plans/IngredientSearch';

    const FreeMealDialogUI = ({
      isSubmitting,
      mealToEdit,
      userId,
      name, setName,
      instructions, setInstructions,
      conflictingIngredientsData,
      ingredients, setIngredients,
      availableFoods,
      userRestrictions,
      handleSubmit
    }) => {

      return (
        <div className="pt-6">
          <DialogHeader className="ml-[0.1rem]">
            <DialogTitle>{mealToEdit ? 'Editar Receta Libre' : 'Añadir Receta Libre'}</DialogTitle>
            <DialogDescription>
              {mealToEdit ? 'Ajusta los detalles si es necesario.' : 'Así que has comido algo que no estaba en el Plan... ¡no pasa nada! Vamos a tenerlo en cuenta.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 flex-1 overflow-y-auto pr-2 styled-scrollbar-green">
            <div className="ml-[0.1rem]">
              <Label htmlFor="name">Nombre de la Receta</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="input-field mt-1" placeholder="Ej: Lentejas de la abuela" />
            </div>
            <div className="ml-[0.1rem]">
              <Label htmlFor="instructions">Detalles (Opcional)</Label>
              <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="input-field mt-1" placeholder="Ej: Llevaban mucho chorizo y morcilla..." />
            </div>

            {conflictingIngredientsData.length > 0 && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-300">Conflicto de Restricciones Detectado</h4>
                    <p className="text-sm text-orange-300/80">Algunos alimentos pueden no ser adecuados para ti:</p>
                    <ul className="mt-2 text-sm">
                      {conflictingIngredientsData.map(conflict => (
                        <li key={conflict.id}>
                          <span className={cn("font-semibold", conflict.isPathology ? "text-red-400" : "text-orange-400")}>{conflict.foodName}</span>
                          <span className="text-gray-400"> ({conflict.restrictionName})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <IngredientSearch
              selectedIngredients={ingredients}
              onIngredientAdded={(ingredient) => {
                setIngredients((prev) => [...prev, ingredient]);
              }}
              availableFoods={availableFoods}
              userRestrictions={userRestrictions}
              createFoodUserId={userId}
            />
          </div>
          <div className="flex justify-center pt-4 border-t border-gray-700">
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting} 
              className="bg-gradient-to-br from-[hsl(211,65%,59%)] to-[hsl(211,65%,49%)] hover:from-[hsl(211,65%,55%)] hover:to-[hsl(211,65%,45%)] text-white"
            >
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : mealToEdit ? 'Actualizar Receta' : 'Introducir Receta Libre'}
            </Button>
          </div>
        </div>
      );
    };

    export default FreeMealDialogUI;
