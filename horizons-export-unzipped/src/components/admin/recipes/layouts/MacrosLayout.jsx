import React from 'react';
import { Button } from '@/components/ui/button';
import AssistantRecommendationPanel from './AssistantRecommendationPanel';
import IngredientTableLayout from './IngredientTableLayout';

const MacroLane = ({ title, gap, foods, onPickFood }) => {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="text-xs text-slate-300">Gap: {Math.round(gap || 0)}g</p>
      </div>
      <div className="space-y-1">
        {foods.map((item) => (
          <div key={item.food.id} className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-200 truncate">{item.food.name}</p>
            <Button type="button" size="sm" variant="outline" className="h-7 border-blue-700 text-blue-300" onClick={() => onPickFood(item.food)}>
              Añadir
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const MacrosLayout = ({
  assistant,
  onPickFood,
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <MacroLane title="Fila Proteínas" gap={assistant.macroNeeds.proteinGap} foods={assistant.macroLanes.protein} onPickFood={onPickFood} />
        <MacroLane title="Fila Carbohidratos" gap={assistant.macroNeeds.carbsGap} foods={assistant.macroLanes.carbs} onPickFood={onPickFood} />
        <MacroLane title="Fila Grasas" gap={assistant.macroNeeds.fatsGap} foods={assistant.macroLanes.fats} onPickFood={onPickFood} />
      </div>
      <AssistantRecommendationPanel
        title="Asistente Macros"
        subtitle="Recomendación de alimentos limpios en P/C/G priorizando tus favoritos."
        suggestions={assistant.topSuggestions.slice(0, 4)}
        onPickFood={onPickFood}
      />
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
