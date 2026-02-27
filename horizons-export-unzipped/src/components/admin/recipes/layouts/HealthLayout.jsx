import React from 'react';
import AssistantRecommendationPanel from './AssistantRecommendationPanel';
import IngredientTableLayout from './IngredientTableLayout';

const HealthLayout = ({
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
      <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/10 p-3">
        <p className="text-sm text-emerald-300 font-medium">
          Cobertura Salud: {assistant.healthCoverage.micronutrientIngredientCount} ingredientes con micronutrientes
        </p>
        <p className="text-xs text-slate-300 mt-1">
          Grupos cubiertos: {assistant.healthCoverage.coveredGroups.length > 0 ? assistant.healthCoverage.coveredGroups.join(', ') : 'Aún no hay grupos'}
        </p>
      </div>
      <AssistantRecommendationPanel
        title="Asistente Salud"
        subtitle="Prioriza vitaminas, minerales y diversidad de grupos sin romper patologías ni preferencias."
        suggestions={assistant.topSuggestions.slice(0, 6)}
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

export default HealthLayout;
