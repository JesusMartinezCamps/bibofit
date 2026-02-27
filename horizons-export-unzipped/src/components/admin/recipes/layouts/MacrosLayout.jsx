import React from 'react';
import AssistantRecommendationPanel from './AssistantRecommendationPanel';
import IngredientTableLayout from './IngredientTableLayout';
import { cn } from '@/lib/utils';

const MacroLane = ({ title, foods, selectedFoodIds, onToggleFood }) => {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
      </div>
      <div className="space-y-1">
        {foods.map((item) => (
          <button
            key={item.food.id}
            type="button"
            onClick={() => onToggleFood(item.food)}
            className={cn(
              'w-full rounded-md border px-2 py-2 text-left transition-colors',
              selectedFoodIds[String(item.food.id)]
                ? 'border-green-600 bg-green-700/20 text-green-200'
                : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:border-blue-600 hover:bg-blue-700/10'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs truncate">{item.food.name}</p>
              <span className="text-[11px]">
                {selectedFoodIds[String(item.food.id)] ? `Quitar (${selectedFoodIds[String(item.food.id)]})` : 'Añadir'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const MacrosLayout = ({
  assistant,
  onToggleFood,
  ingredients,
  allFoods,
  availableFoods,
  onIngredientChange,
  onRemoveIngredient,
  planRestrictions,
  displayMode,
  totalMacros,
  mealTargetMacros,
}) => {
  return (
    <div className="space-y-3">
      <AssistantRecommendationPanel
        title="Asistente Macros"
        subtitle="Esta vista te permite cuadrar proteínas, carbohidratos y grasas con interacción rápida: pulsa cualquier alimento de las filas para añadirlo o quitarlo."
        infoOnly={true}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <MacroLane
          title="Fila Proteínas"
          foods={assistant.macroLanes.protein}
          selectedFoodIds={assistant.selectedFoodIds}
          onToggleFood={onToggleFood}
        />
        <MacroLane
          title="Fila Carbohidratos"
          foods={assistant.macroLanes.carbs}
          selectedFoodIds={assistant.selectedFoodIds}
          onToggleFood={onToggleFood}
        />
        <MacroLane
          title="Fila Grasas"
          foods={assistant.macroLanes.fats}
          selectedFoodIds={assistant.selectedFoodIds}
          onToggleFood={onToggleFood}
        />
      </div>
      <IngredientTableLayout
        ingredients={ingredients}
        allFoods={allFoods}
        availableFoods={availableFoods}
        onIngredientChange={onIngredientChange}
        onRemoveIngredient={onRemoveIngredient}
        planRestrictions={planRestrictions}
        displayMode={displayMode}
        totalMacros={totalMacros}
        mealTargetMacros={mealTargetMacros}
      />
    </div>
  );
};

export default MacrosLayout;
