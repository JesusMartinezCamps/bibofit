import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const MealSelectionStep = ({ onNext, isLoading }) => {
  const meals = [
    { id: 1, name: 'Desayuno', selected: true },
    { id: 2, name: 'Almuerzo', selected: true },
    { id: 3, name: 'Cena', selected: true },
    { id: 4, name: 'Snack', selected: false },
  ];

  const handleNext = () => {
    onNext({ selectedMeals: meals.filter(m => m.selected) });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="text-center space-y-2 mb-6">
          <p className="text-gray-400">¿Cuántas comidas harás al día?</p>
        </div>

        <div className="grid gap-4">
          {meals.map((meal) => (
             <Card key={meal.id} className="bg-gray-800/50 border-gray-700 cursor-pointer hover:border-green-500/50 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                    <span className="font-medium text-white">{meal.name}</span>
                    <Button variant="ghost" size="sm" className="text-green-400 hover:text-green-300 hover:bg-green-400/10">
                        {meal.selected ? 'Configurado' : 'Añadir'}
                    </Button>
                </CardContent>
             </Card>
          ))}
          
          <Button variant="outline" className="border-dashed border-gray-600 text-gray-400 h-14 w-full">
             <PlusCircle className="mr-2 h-4 w-4" /> Añadir Comida Extra
          </Button>
        </div>
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button 
            onClick={handleNext} 
            disabled={isLoading}
            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
        >
            {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2"/> Guardando...</>
            ) : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
};

export default MealSelectionStep;