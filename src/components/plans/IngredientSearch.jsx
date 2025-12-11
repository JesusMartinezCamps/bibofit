import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getConflictInfo } from '@/lib/restrictionChecker.js';

const ConflictBadge = ({ conflict }) => {
  if (!conflict) return null;

  const config = {
    'non-preferred': { icon: <ThumbsDown size={14} />, color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    'preferred': { icon: <ThumbsUp size={14} />, color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    'condition_avoid': { icon: <AlertTriangle size={14} />, color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    'condition_recommend': { icon: <ThumbsUp size={14} />, color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    'sensitivity': { icon: <AlertTriangle size={14} />, color: 'bg-red-500/20 text-red-300 border-red-500/30' }, // Updated to red
  };

  const { icon, color } = config[conflict.type] || {};

  return (
    <Badge variant="outline" className={cn('text-xs font-normal flex items-center gap-1.5', color)}>
      {icon}
      {conflict.reason}
    </Badge>
  );
};

const IngredientSearch = ({ selectedIngredients, onIngredientAdded, availableFoods, userRestrictions, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }

    // Helper function to normalize text (remove accents and lowercase)
    const normalizeText = (text) => {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    const normalizedTerm = normalizeText(searchTerm);

    const results = (availableFoods || [])
      .filter(food =>
        food.name && 
        normalizeText(food.name).includes(normalizedTerm) &&
        !selectedIngredients.some(ing => ing.food_id === food.id && !ing.is_user_created)
      )
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

  }, [searchTerm, availableFoods, selectedIngredients, userRestrictions]);

  const handleSelectFood = (food) => {
    const food_unit = food.food_unit || 'gramos';
    const quantity = food_unit === 'unidades' ? 1 : 100;
    
    const newIngredient = {
      food_id: food.id,
      food_name: food.name,
      quantity: quantity,
      grams: quantity, // Explicitly set grams to match quantity
      is_free: false,
      food_unit: food_unit,
      is_user_created: food.is_user_created
    };
    onIngredientAdded(newIngredient);
  };

  const getBorderColor = (conflict) => {
    if (!conflict) return 'border-gray-700 hover:border-blue-500';
    switch (conflict.type) {
      case 'preferred':
      case 'condition_recommend':
        return 'border-green-500/50 hover:border-green-400 bg-green-900/10';
      case 'non-preferred':
        return 'border-orange-500/50 hover:border-orange-400';
      case 'sensitivity':
        return 'border-red-500/50 hover:border-red-400 bg-red-900/10';
      case 'condition_avoid':
        return 'border-red-500/80 hover:border-red-600 bg-red-900/20';
      default:
        return 'border-gray-700 hover:border-blue-500';
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col p-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-gray-400 hover:bg-slate-800 hover:text-white">
          <ArrowLeft size={20} />
        </Button>
        <h2 className="text-xl font-semibold">Buscar Ingrediente</h2>
      </div>
      <div>
        <Input
          type="text"
          placeholder="Buscar ingrediente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field"
          autoFocus
        />
      </div>
      <div className="flex-1 overflow-y-auto styled-scrollbar-green -mr-2 pr-2">
        {searchResults.length > 0 ? (
          <div className="space-y-2">
            {searchResults.map((food) => (
              <div
                key={`food-${food.id}-${food.is_user_created}`}
                onClick={() => handleSelectFood(food)}
                className={cn(
                  "p-3 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-md transition-colors",
                  getBorderColor(food.conflict),
                  "border border-opacity-50"
                )}
              >
                <span className="font-medium text-gray-200">{food.name}</span>
                <div className="flex items-center gap-2 mt-1 sm:mt-0">
                  {food.conflict && <ConflictBadge conflict={food.conflict} />}
                </div>
              </div>
            ))}
          </div>
        ) : (
          searchTerm && <p className="text-center text-gray-400 pt-8">No se encontraron resultados.</p>
        )}
      </div>
    </div>
  );
};

export default IngredientSearch;