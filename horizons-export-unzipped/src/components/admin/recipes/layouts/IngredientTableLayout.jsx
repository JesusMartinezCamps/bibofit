import React from 'react';
import IngredientRow from '../IngredientRow';
import TotalsRow from '../TotalsRow';
import TargetMacrosRow from '../TargetMacrosRow';

const macroGridStyle = { gridTemplateColumns: 'minmax(150px, 1fr) 100px repeat(4, minmax(70px, auto)) 40px' };

const IngredientTableLayout = ({
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
    <div className="rounded-lg bg-slate-950/50 border border-slate-800">
      <div className="overflow-x-auto no-scrollbar">
        <div className="p-3 min-w-[750px]">
          <div className="space-y-2 mt-2">
            {ingredients.map((ing) => (
              <IngredientRow
                key={ing.local_id}
                ingredient={ing}
                allFoods={allFoods}
                availableFoods={availableFoods}
                onIngredientChange={onIngredientChange}
                onRemove={onRemoveIngredient}
                planRestrictions={planRestrictions}
                gridStyle={macroGridStyle}
                displayMode={displayMode}
              />
            ))}
          </div>

          <div className="space-y-2">
            <TotalsRow totalMacros={totalMacros} gridStyle={macroGridStyle} />
            {mealTargetMacros ? <TargetMacrosRow targetMacros={mealTargetMacros} gridStyle={macroGridStyle} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IngredientTableLayout;
