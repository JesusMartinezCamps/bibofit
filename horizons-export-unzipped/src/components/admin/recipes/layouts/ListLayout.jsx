import React, { useMemo } from 'react';
import RecipeView from '@/components/shared/RecipeView';

const ListLayout = ({
  ingredients,
  allFoods,
  totalMacros,
  mealTargetMacros,
  planRestrictions,
  onIngredientsReplace,
}) => {
  const recipeForList = useMemo(
    () => ({
      name: 'Constructor',
      difficulty: 'Media',
      prep_time_min: null,
      instructions: '',
      ingredients,
    }),
    [ingredients]
  );

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50">
      <RecipeView
        recipe={recipeForList}
        allFoods={allFoods}
        allVitamins={[]}
        allMinerals={[]}
        allFoodGroups={[]}
        macros={totalMacros}
        mealTargetMacros={mealTargetMacros}
        userRestrictions={planRestrictions}
        isEditing={true}
        onFormChange={() => {}}
        onIngredientsChange={onIngredientsReplace}
        onRemoveIngredient={(ingredientToRemove) => {
          const ingredientId = ingredientToRemove.local_id || ingredientToRemove.id;
          const updated = ingredients.filter((ing) => String(ing.local_id || ing.id) !== String(ingredientId));
          onIngredientsReplace(updated);
        }}
      />
    </div>
  );
};

export default ListLayout;
