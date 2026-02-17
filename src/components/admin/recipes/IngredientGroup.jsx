import React from 'react';
import IngredientRow from './IngredientRow';

const IngredientGroup = React.memo(({
    group,
    view,
    allFoods,
    allFoodGroups,
    availableFoods,
    onGroupChange,
    onIngredientChange,
    onAddIngredient,
    onRemoveIngredient,
    onRemoveGroup,
    planRestrictions,
    gridStyle
}) => {
    const usedFoodIdsInGroup = React.useMemo(() => {
        return new Set(group.ingredients.map(ing => ing.food_id).filter(Boolean));
    }, [group.ingredients]);

    // Flattened display: No card styles, no group header, just the rows
    // We remove the Card wrapper to achieve the "flat list" requirement
    return (
        <div className="space-y-1">
            {group.ingredients.map((ing, index) => (
                <IngredientRow
                    key={ing.local_id}
                    ingredient={{...ing, food_group_id: group.group_id }}
                    view={view}
                    allFoods={allFoods}
                    availableFoods={availableFoods}
                    usedFoodIdsInGroup={usedFoodIdsInGroup}
                    onIngredientChange={(field, value) => onIngredientChange(group.local_group_id, ing.local_id, field, value)}
                    onRemove={() => onRemoveIngredient(group.local_group_id, ing.local_id)}
                    planRestrictions={planRestrictions}
                    gridStyle={gridStyle}
                    isFirst={index === 0}
                    onAddIngredient={() => onAddIngredient(group.local_group_id)}
                />
            ))}
        </div>
    );
});

IngredientGroup.displayName = 'IngredientGroup';

export default IngredientGroup;