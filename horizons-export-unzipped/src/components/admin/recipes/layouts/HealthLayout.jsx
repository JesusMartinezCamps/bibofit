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
      <div className="rounded-lg border border-emerald-700/50 bg-green-900/10 p-3">
        <p className="text-sm text-emerald-300 font-medium">
          Cobertura Salud: {assistant.healthCoverage.completionPct}% ({assistant.healthCoverage.coveredPriorityGroupNames.length}/{assistant.healthCoverage.targetCount} familias)
        </p>
        <p className="text-xs text-slate-300 mt-1">
          Una comida completa en este layout es incluir al menos 1 alimento de cada familia prioritaria.
        </p>
        {assistant.healthCoverage.missingPriorityGroupNames.length > 0 ? (
          <p className="text-xs text-emerald-200/90 mt-2">
            Te faltan por cubrir: {assistant.healthCoverage.missingPriorityGroupNames.join(', ')}. Vas bien, sigue sumando variedad.
          </p>
        ) : (
          <p className="text-xs text-emerald-200/90 mt-2">
            Excelente, ya cubres todas las familias prioritarias.
          </p>
        )}
      </div>
      <AssistantRecommendationPanel
        title="Asistente Salud"
        subtitle="Prioriza familias (Verduras y Hortalizas, Frutas, Legumbres, Frutos secos, Semillas) junto con micronutrientes. El objetivo es animarte a completar la cobertura, no penalizarte."
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
