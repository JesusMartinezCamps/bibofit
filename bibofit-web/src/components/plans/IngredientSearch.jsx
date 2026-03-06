import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getConflictInfo } from '@/lib/restrictionChecker.js';
import { useAuth } from '@/contexts/AuthContext';
import FoodLookupPanel from '@/components/shared/FoodLookupPanel';
import CreateFoodInlineDialog from '@/components/shared/CreateFoodInlineDialog';
import { normalizeSearchText, splitSearchTokens } from '@/lib/foodSearchUtils';
import { isUserCreatedFood } from '@/lib/foodIdentity';
import FoodStatusBadge from '@/components/shared/food/FoodStatusBadge';

const ConflictBadge = ({ conflict }) => {
  if (!conflict) return null;

  const config = {
    'non-preferred': { icon: <ThumbsDown size={14} />, color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/35' },
    'preferred': { icon: <ThumbsUp size={14} />, color: 'bg-green-500/15 text-green-900 dark:text-green-300 border-green-500/35' },
    'condition_avoid': { icon: <AlertTriangle size={14} />, color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/35' },
    'condition_recommend': { icon: <ThumbsUp size={14} />, color: 'bg-green-500/15 text-green-900 dark:text-green-300 border-green-500/35' },
    'sensitivity': { icon: <AlertTriangle size={14} />, color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/35' },
  };

  const { icon, color } = config[conflict.type] || {};

  return (
    <Badge variant="outline" className={cn('text-xs font-normal flex items-center gap-1.5', color)}>
      {icon}
      {conflict.reason}
    </Badge>
  );
};

const UserFoodStatusBadge = ({ food }) => {
  if (!food) return null;
  const isUserCreated = isUserCreatedFood(food);
  if (!isUserCreated) return null;

  return <FoodStatusBadge status={food.status} moderationStatus={food.moderation_status} />;
};

const IngredientSearch = ({
  selectedIngredients,
  onIngredientAdded,
  availableFoods,
  userRestrictions,
  onBack = () => {},
  onOpenCreateFoodModal,
  onFoodCreated,
  createFoodUserId,
}) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCreateFoodDialogOpen, setIsCreateFoodDialogOpen] = useState(false);
  const [foodToCreate, setFoodToCreate] = useState(null);

  const getFoodGroupNames = (food) => {
    const directGroups = (food?.food_to_food_groups || [])
      .map((fg) => fg?.food_group?.name || fg?.food_group_name)
      .filter(Boolean);
    return directGroups;
  };

  const getRecommendedConditionNames = (food) => {
    const positiveRelations = new Set(['recomendar', 'recommend', 'to_recommend', 'recommended', 'beneficial', 'indicado', 'favorable']);
    return (food?.food_medical_conditions || [])
      .filter((entry) => positiveRelations.has(normalizeSearchText(entry?.relation_type)))
      .map((entry) => entry?.condition?.name || entry?.medical_conditions?.name)
      .filter(Boolean);
  };

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      setActiveIndex(0);
      return;
    }

    const queryTokens = splitSearchTokens(searchTerm);

    const results = (availableFoods || [])
      .filter(food => {
        if (!food.name) return false;
        const foodIsUserCreated = isUserCreatedFood(food);
        return !selectedIngredients.some(
          (ing) =>
            String(ing.food_id) === String(food.id) &&
            !!ing.is_user_created === foodIsUserCreated
        );
      })
      .filter((food) => {
        const searchableText = [
          food.name,
          ...getFoodGroupNames(food),
          ...getRecommendedConditionNames(food)
        ]
          .filter(Boolean)
          .map(normalizeSearchText)
          .join(' ');

        return queryTokens.every((token) => searchableText.includes(token));
      })
      .map(food => ({
        ...food,
        conflict: getConflictInfo(food, userRestrictions)
      }))
      .sort((a, b) => {
        // Priority: Preferred/Recommended (1) -> Neutral (2) -> Sensitivity (3) -> Non-preferred (4) -> Avoid (5)
        const priority = { 
            'preferred': 1, 
            'condition_recommend': 1, 
            undefined: 2, // No conflict
            'sensitivity': 3, 
            'non-preferred': 4, 
            'condition_avoid': 5 
        };
        
        const typeA = a.conflict?.type;
        const typeB = b.conflict?.type;
        
        const priorityA = priority[typeA] !== undefined ? priority[typeA] : 2;
        const priorityB = priority[typeB] !== undefined ? priority[typeB] : 2;

        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50);

    setSearchResults(results);
    setActiveIndex(0);

  }, [searchTerm, availableFoods, selectedIngredients, userRestrictions]);

  const handleSelectFood = (food) => {
    const food_unit = food.food_unit || 'gramos';
    const quantity = food_unit === 'unidades' ? 1 : 100;
    const foodIsUserCreated = isUserCreatedFood(food);
    
    const newIngredient = {
      food_id: food.id,
      food_name: food.name,
      quantity: quantity,
      grams: quantity, // Explicitly set grams to match quantity
      is_free: false,
      food_unit: food_unit,
      is_user_created: foodIsUserCreated,
      food,
    };
    onIngredientAdded(newIngredient);
  };

  const getBorderColor = (conflict) => {
    if (!conflict) return 'border-border hover:border-sky-500 bg-card/80';
    switch (conflict.type) {
      case 'preferred':
      case 'condition_recommend':
        return 'border-green-500/50 hover:border-green-500 bg-green-500/12 dark:bg-green-900/10';
      case 'non-preferred':
        return 'border-orange-500/50 hover:border-orange-500 bg-orange-500/12 dark:bg-orange-900/10';
      case 'sensitivity':
        return 'border-red-500/50 hover:border-red-500 bg-red-500/12 dark:bg-red-900/10';
      case 'condition_avoid':
        return 'border-red-500/80 hover:border-red-600 bg-red-500/18 dark:bg-red-900/20';
      default:
        return 'border-border hover:border-sky-500 bg-card/80';
    }
  };

  const handleSearchKeyDown = (e) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % searchResults.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const selectedFood = searchResults[activeIndex] || searchResults[0];
      if (selectedFood) handleSelectFood(selectedFood);
    }
  };

  const handleOpenCreateFood = () => {
    const normalizedName = searchTerm.trim();
    if (!normalizedName) return;
    const draftFood = { name: normalizedName };

    if (onOpenCreateFoodModal) {
      onOpenCreateFoodModal(draftFood);
      return;
    }

    setFoodToCreate(draftFood);
    setIsCreateFoodDialogOpen(true);
  };

  const handleFoodCreatedInline = (newFood) => {
    if (!newFood) return;
    const normalizedNewFood = {
      ...newFood,
      is_user_created: true,
      food_sensitivities: newFood.food_sensitivities || [],
      food_medical_conditions: newFood.food_medical_conditions || [],
      food_vitamins: newFood.food_vitamins || [],
      food_minerals: newFood.food_minerals || [],
      food_to_food_groups: newFood.food_to_food_groups || [],
    };
    onFoodCreated?.(normalizedNewFood);
    handleSelectFood(normalizedNewFood);
    setIsCreateFoodDialogOpen(false);
    setFoodToCreate(null);
    setSearchTerm('');
  };

  return (
    <>
      <FoodLookupPanel
        title="Buscar Ingrediente"
        showHeader={true}
        onBack={onBack}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchKeyDown={handleSearchKeyDown}
        placeholder="Buscar ingrediente, grupo o patología..."
        helperText="Puedes buscar por nombre de alimento, familia/grupo de alimento o patología (mostrará alimentos recomendados para esa condición)."
      >
        {searchResults.length > 0 ? (
          <div className="space-y-2 p-2">
            {searchResults.map((food, index) => (
              <div
                key={`food-${food.id}`}
                onClick={() => handleSelectFood(food)}
                className={cn(
                  "p-3 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-md transition-colors",
                  getBorderColor(food.conflict),
                  "border border-opacity-50",
                  activeIndex === index && "ring-1 ring-sky-400 border-sky-500/70"
                )}
              >
                <span className="font-medium text-foreground">{food.name}</span>
                <div className="flex items-center gap-2 mt-1 sm:mt-0">
                  <UserFoodStatusBadge food={food} />
                  {food.conflict && <ConflictBadge conflict={food.conflict} />}
                </div>
              </div>
            ))}
          </div>
        ) : (
          searchTerm.trim() && (
            <div className="text-center text-muted-foreground pt-8 space-y-3">
              <p>No se encontraron resultados.</p>
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenCreateFood}
                className="border-dashed border-emerald-500/60 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-900/20 hover:bg-emerald-500/20"
              >
                Crear "{searchTerm.trim()}"
              </Button>
            </div>
          )
        )}
      </FoodLookupPanel>
      {!onOpenCreateFoodModal && (
        <CreateFoodInlineDialog
          open={isCreateFoodDialogOpen}
          onOpenChange={setIsCreateFoodDialogOpen}
          userId={createFoodUserId || user?.id}
          foodToCreate={foodToCreate}
          onFoodCreated={handleFoodCreatedInline}
        />
      )}
    </>
  );
};

export default IngredientSearch;
