import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import FoodCard from '@/components/admin/recipes/FoodCard';
import { useAuth } from '@/contexts/AuthContext';
import FoodLookupPanel from '@/components/shared/FoodLookupPanel';
import { normalizeSearchText, splitSearchTokens } from '@/lib/foodSearchUtils';
import { FOOD_CARD_SELECT, mergeFoodsById, normalizeFoodRecord } from '@/lib/food/foodModel';
import { isCoachRole } from '@/lib/roles';

const isSubsequence = (needle, haystack) => {
  if (!needle) return true;
  let needleIdx = 0;
  for (let i = 0; i < haystack.length && needleIdx < needle.length; i += 1) {
    if (haystack[i] === needle[needleIdx]) {
      needleIdx += 1;
    }
  }
  return needleIdx === needle.length;
};

const scoreToken = (token, normalizedText) => {
  if (!token) return 0;
  if (normalizedText.startsWith(token)) return 0;
  if (normalizedText.includes(token)) return 1;
  if (isSubsequence(token, normalizedText)) return 2;
  return Number.POSITIVE_INFINITY;
};

const scoreTextWithTokens = (text, tokens) => {
  if (!tokens || tokens.length === 0) return 0;
  const normalizedText = normalizeSearchText(text || '');
  if (!normalizedText) return Number.POSITIVE_INFINITY;

  let score = 0;
  for (const token of tokens) {
    const tokenScore = scoreToken(token, normalizedText);
    if (!Number.isFinite(tokenScore)) return Number.POSITIVE_INFINITY;
    score += tokenScore;
  }
  return score;
};

const rankFoodsByScore = (foods, scoreResolver) =>
  foods
    .map((food) => ({ food, score: scoreResolver(food) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return (a.food?.name || '').localeCompare(b.food?.name || '', 'es');
    })
    .map((entry) => entry.food);

const MAX_VISIBLE_RESULTS = 15;
const toArray = (value) => (Array.isArray(value) ? value : []);

const getFoodGroupNames = (food) =>
  toArray(food?.food_groups)
    .map((item) => item?.name)
    .filter(Boolean);

const getFoodSeasonNames = (food) =>
  toArray(food?.seasons)
    .map((item) => item?.name)
    .filter(Boolean);

const getFoodStoreNames = (food) => {
  const normalizedStores = toArray(food?.stores)
    .map((item) => (typeof item === 'string' ? item : item?.name))
    .filter(Boolean);

  if (normalizedStores.length > 0) return normalizedStores;

  return toArray(food?.food_to_stores)
    .map((item) => item?.store?.name || item?.stores?.name)
    .filter(Boolean);
};

const getFoodMacroRoleNames = (food) => {
  const normalizedRoles = toArray(food?.macro_roles)
    .map((item) => (typeof item === 'string' ? item : item?.name))
    .filter(Boolean);

  if (normalizedRoles.length > 0) return normalizedRoles;

  return toArray(food?.food_to_macro_roles)
    .map((item) => item?.macro_role?.name || item?.macro_roles?.name)
    .filter(Boolean);
};

const scoreAnyName = (names, tokens) =>
  names.reduce((best, name) => {
    const score = scoreTextWithTokens(name, tokens);
    return score < best ? score : best;
  }, Number.POSITIVE_INFINITY);

const rankFoodsByNames = (foods, namesResolver, tokens) =>
  rankFoodsByScore(foods, (food) => scoreAnyName(namesResolver(food), tokens));

const extractPrefixedQuery = (normalizedQuery, prefixes) => {
  for (const prefix of prefixes) {
    if (normalizedQuery.startsWith(prefix)) {
      return normalizedQuery.slice(prefix.length).trim();
    }
  }
  return null;
};

const scoreFoodAgainstGeneralTokens = (food, tokens) => {
  const nameScore = scoreTextWithTokens(food?.name, tokens);
  const groupScore = scoreAnyName(getFoodGroupNames(food), tokens);
  const macroRoleScore = scoreAnyName(getFoodMacroRoleNames(food), tokens);
  const seasonScore = scoreAnyName(getFoodSeasonNames(food), tokens);
  const storeScore = scoreAnyName(getFoodStoreNames(food), tokens);

  return Math.min(
    nameScore,
    Number.isFinite(groupScore) ? groupScore + 1 : Number.POSITIVE_INFINITY,
    Number.isFinite(macroRoleScore) ? macroRoleScore + 1 : Number.POSITIVE_INFINITY,
    Number.isFinite(seasonScore) ? seasonScore + 1 : Number.POSITIVE_INFINITY,
    Number.isFinite(storeScore) ? storeScore + 1 : Number.POSITIVE_INFINITY
  );
};

const FoodSearch = ({ onSelectFood, selectedFoodId, onActionComplete, excludeSensitivities = [], userId, refreshTrigger }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allFoods, setAllFoods] = useState([]);
  const [userCreatedFoods, setUserCreatedFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const isCoach = isCoachRole(user?.role);

  const fetchAllFoods = useCallback(async () => {
    setLoading(true);
    try {
      const targetUserId = userId || user?.id;

      const [
        { data: foodsData, error: foodsError },
        { data: userFoodsData, error: userFoodsError }
      ] = await Promise.all([
        isCoach
          ? supabase
              .from('food')
              .select(FOOD_CARD_SELECT)
              .or('user_id.is.null,status.eq.approved_general')
              .order('name', { ascending: true })
          : supabase
              .from('food')
              .select(FOOD_CARD_SELECT)
              .or('status.is.null,status.neq.rejected')
              .order('name', { ascending: true }),
        targetUserId && isCoach ? supabase
          .from('food')
          .select(FOOD_CARD_SELECT)
          .eq('user_id', targetUserId)
          .or('status.is.null,status.neq.rejected')
          .order('name', { ascending: true }) : Promise.resolve({ data: [], error: null })
      ]);

      if (foodsError) throw foodsError;
      if (userFoodsError) {
          console.error("Supabase error (private foods):", JSON.stringify(userFoodsError, null, 2));
      }

      const transformedFoods = (foodsData || []).map(normalizeFoodRecord);
      const transformedUserFoods = (userFoodsData || []).map(normalizeFoodRecord);

      setAllFoods(transformedFoods);
      setUserCreatedFoods(transformedUserFoods);
    } catch (error) {
      toast({
        title: 'Error de carga',
        description: 'No se pudieron cargar los alimentos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, userId, user?.id, isCoach]);


  useEffect(() => {
    fetchAllFoods();
  }, [fetchAllFoods, refreshTrigger]); // Use refreshTrigger to re-fetch
  
  const handleDeleteFood = async (foodIdToDelete, options = {}) => {
    const { confirmed = false, foodName = '' } = options;
    if (!confirmed) {
      const didConfirm = window.confirm(
        `¿Seguro que quieres eliminar ${foodName ? `"${foodName}"` : 'este alimento'}? Esta acción no se puede deshacer.`
      );
      if (!didConfirm) return;
    }

    try {
        const { error } = await supabase.rpc('delete_food_with_dependencies', { p_food_id: foodIdToDelete });
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Alimento eliminado correctamente y todas sus dependencias.' });
        if(onActionComplete) onActionComplete();
    } catch (error) {
        console.error('Error deleting food:', error);
        toast({ title: 'Error', description: `No se pudo eliminar el alimento. ${error.message}`, variant: 'destructive' });
    }
  };

  const [activeIndex, setActiveIndex] = useState(0);

  const handleSearchKeyDown = (e) => {
    if (filteredFoods.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredFoods.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredFoods.length) % filteredFoods.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredFoods[activeIndex] || filteredFoods[0];
      if (selected) onSelectFood(selected);
    }
  };

  const handleFoodClick = (food) => {
    onSelectFood(food);
  };

  const combinedFoods = useMemo(() => {
    return mergeFoodsById([...allFoods, ...userCreatedFoods]);
  }, [allFoods, userCreatedFoods]);

  const filteredFoods = useMemo(() => {
    let foods = [...combinedFoods];
    
    if (excludeSensitivities.length > 0) {
      foods = foods.filter(food => {
        const foodSensitivityIds = food.food_sensitivities?.map(fa => fa.sensitivities?.id).filter(Boolean) || [];
        return !excludeSensitivities.some(sensitivityId => foodSensitivityIds.includes(sensitivityId));
      });
    }
    
    const normalizedFilter = normalizeSearchText(searchTerm.trim());
    
    let results = foods;

    if (normalizedFilter) {
      const groupQuery = extractPrefixedQuery(normalizedFilter, ['grupo:', 'group:', 'categoria:']);
      const macroRoleQuery = extractPrefixedQuery(normalizedFilter, ['macro:', 'macro_rol:', 'rol:', 'macrorol:']);
      const seasonQuery = extractPrefixedQuery(normalizedFilter, ['temporada:', 'season:']);
      const storeQuery = extractPrefixedQuery(normalizedFilter, ['tienda:', 'store:', 'lugar:', 'compra:']);

      if (normalizedFilter.startsWith('vitamina:')) {
        const vitaminName = normalizedFilter.substring(9).trim();
        const vitaminTokens = splitSearchTokens(vitaminName);
        results = vitaminTokens.length === 0
          ? foods
          : rankFoodsByNames(
              foods,
              (food) => toArray(food?.food_vitamins).map((item) => item?.vitamins?.name).filter(Boolean),
              vitaminTokens
            );
      } else if (normalizedFilter.startsWith('mineral:')) {
        const mineralName = normalizedFilter.substring(8).trim();
        const mineralTokens = splitSearchTokens(mineralName);
        results = mineralTokens.length === 0
          ? foods
          : rankFoodsByNames(
              foods,
              (food) => toArray(food?.food_minerals).map((item) => item?.minerals?.name).filter(Boolean),
              mineralTokens
            );
      } else if (groupQuery !== null) {
        const groupTokens = splitSearchTokens(groupQuery);
        results = groupTokens.length === 0 ? foods : rankFoodsByNames(foods, getFoodGroupNames, groupTokens);
      } else if (macroRoleQuery !== null) {
        const macroRoleTokens = splitSearchTokens(macroRoleQuery);
        results = macroRoleTokens.length === 0 ? foods : rankFoodsByNames(foods, getFoodMacroRoleNames, macroRoleTokens);
      } else if (seasonQuery !== null) {
        const seasonTokens = splitSearchTokens(seasonQuery);
        results = seasonTokens.length === 0
          ? foods
          : rankFoodsByNames(foods, getFoodSeasonNames, seasonTokens);
      } else if (storeQuery !== null) {
        const storeTokens = splitSearchTokens(storeQuery);
        results = storeTokens.length === 0 ? foods : rankFoodsByNames(foods, getFoodStoreNames, storeTokens);
      } else if (normalizedFilter.startsWith('sensibilidad:')) {
          const sensitivityName = normalizedFilter.substring(13).trim();
          const sensitivityTokens = splitSearchTokens(sensitivityName);
          results = sensitivityTokens.length === 0
            ? foods
            : rankFoodsByNames(
                foods,
                (food) => toArray(food?.food_sensitivities).map((item) => item?.sensitivities?.name).filter(Boolean),
                sensitivityTokens
              );
      } else {
        const nameTokens = splitSearchTokens(normalizedFilter);
        results = rankFoodsByScore(foods, (food) => scoreFoodAgainstGeneralTokens(food, nameTokens));
      }
    } else {
      results = [...foods].sort((a, b) => (a?.name || '').localeCompare(b?.name || '', 'es'));
    }
    
    return results.slice(0, MAX_VISIBLE_RESULTS);
    
  }, [searchTerm, combinedFoods, excludeSensitivities]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    if (filteredFoods.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= filteredFoods.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, filteredFoods.length]);

  const placeholderText = useMemo(() => {
    if (loading) return "Cargando alimentos...";
    const total = combinedFoods.length;
    return `Busca entre los ${total} alimentos...`;
  }, [loading, combinedFoods.length]);

  return (
    <div className="h-full flex flex-col">
      <FoodLookupPanel
        showHeader={false}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchKeyDown={handleSearchKeyDown}
        placeholder={placeholderText}
        showClearButton={true}
        onClearSearch={() => {
          setSearchTerm('');
          setActiveIndex(0);
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-green-500" />
          </div>
        ) : (
          <AnimatePresence>
            {filteredFoods.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3 p-2"
              >
                {filteredFoods.map((food, index) => (
                  <div
                    key={`${food.isUserCreated ? 'user' : 'food'}-${food.id}`}
                    onClick={() => handleFoodClick(food)}
                    tabIndex={0}
                    className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-lg ${selectedFoodId === food.id ? 'ring-1 ring-green-500' : ''} ${activeIndex === index ? 'ring-1 ring-sky-400' : ''}`}
                  >
                    <FoodCard
                      food={food}
                      onSelect={onSelectFood}
                      isSelected={selectedFoodId === food.id}
                      onDelete={isCoach ? null : handleDeleteFood}
                    />
                  </div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center text-muted-foreground py-4 space-y-3">
                <p>{searchTerm ? 'No se encontraron resultados.' : 'No hay alimentos en la base de datos.'}</p>
              </div>
            )}
          </AnimatePresence>
        )}
      </FoodLookupPanel>
    </div>
  );
};

export default FoodSearch;
