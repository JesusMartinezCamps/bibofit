import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import FoodCard from '@/components/admin/recipes/FoodCard';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import FoodLookupPanel from '@/components/shared/FoodLookupPanel';
import CreateFoodInlineDialog from '@/components/shared/CreateFoodInlineDialog';
import { normalizeSearchText } from '@/lib/foodSearchUtils';
import { FOOD_CARD_SELECT, mergeFoodsById, normalizeFoodRecord } from '@/lib/food/foodModel';

const FoodSearch = ({ onSelectFood, selectedFoodId, onActionComplete, excludeSensitivities = [], userId, refreshTrigger }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allFoods, setAllFoods] = useState([]);
  const [userCreatedFoods, setUserCreatedFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userSensitivities, setUserSensitivities] = useState([]);
  const [isCreateFoodOpen, setIsCreateFoodOpen] = useState(false);
  const [foodToCreate, setFoodToCreate] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';

  const fetchUserSensitivities = useCallback(async () => {
    if (!userId && !user?.id) return [];
    
    const targetUserId = userId || user.id;
    
    try {
      const { data: userSensitivityData, error } = await supabase
        .from('user_sensitivities')
        .select('sensitivity_id')
        .eq('user_id', targetUserId);

      if (error) throw error;
      return userSensitivityData?.map(ua => ua.sensitivity_id) || [];
    } catch (error) {
      console.error('Error fetching user sensitivities:', error);
      return [];
    }
  }, [userId, user?.id]);

  const fetchAllFoods = useCallback(async () => {
    setLoading(true);
    try {
      const targetUserId = userId || user?.id;

      const [
        { data: foodsData, error: foodsError },
        { data: userFoodsData, error: userFoodsError },
        userSensitivityIds
      ] = await Promise.all([
        supabase
          .from('food')
          .select(FOOD_CARD_SELECT)
          .or('user_id.is.null,status.eq.approved_general')
          .order('name', { ascending: true }),
        targetUserId ? supabase
          .from('food')
          .select(FOOD_CARD_SELECT)
          .eq('user_id', targetUserId)
          .or('status.is.null,status.neq.rejected')
          .order('name', { ascending: true }) : Promise.resolve({ data: [], error: null }),
        fetchUserSensitivities()
      ]);

      if (foodsError) throw foodsError;
      if (userFoodsError) {
          console.error("Supabase error (private foods):", JSON.stringify(userFoodsError, null, 2));
      }

      const transformedFoods = (foodsData || []).map(normalizeFoodRecord);
      const transformedUserFoods = (userFoodsData || []).map(normalizeFoodRecord);

      setAllFoods(transformedFoods);
      setUserCreatedFoods(transformedUserFoods);
      setUserSensitivities(userSensitivityIds);
    } catch (error) {
      toast({
        title: 'Error de carga',
        description: 'No se pudieron cargar los alimentos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, fetchUserSensitivities, userId, user?.id]);


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

  const handleCreateFoodClick = () => {
    const normalized = searchTerm.trim();
    if (!normalized) return;
    setFoodToCreate({ name: normalized });
    setIsCreateFoodOpen(true);
  };

  const handleFoodCreated = async (newFood) => {
    setIsCreateFoodOpen(false);
    setFoodToCreate(null);
    setSearchTerm('');
    await fetchAllFoods();
    if (newFood) onSelectFood(normalizeFoodRecord(newFood));
    if (onActionComplete) onActionComplete();
  };

  const combinedFoods = useMemo(() => {
    return mergeFoodsById([...allFoods, ...userCreatedFoods]);
  }, [allFoods, userCreatedFoods]);

  const filteredFoods = useMemo(() => {
    let foods = [...combinedFoods];
    
    if (userSensitivities.length > 0) {
      foods = foods.filter(food => {
        const foodSensitivityIds = food.food_sensitivities?.map(fa => fa.sensitivities?.id).filter(Boolean) || [];
        return !userSensitivities.some(userSensitivityId => foodSensitivityIds.includes(userSensitivityId));
      });
    }
    
    if (excludeSensitivities.length > 0) {
      foods = foods.filter(food => {
        const foodSensitivityIds = food.food_sensitivities?.map(fa => fa.sensitivities?.id).filter(Boolean) || [];
        return !excludeSensitivities.some(sensitivityId => foodSensitivityIds.includes(sensitivityId));
      });
    }
    
    const normalizedFilter = normalizeSearchText(searchTerm.trim());
    
    let results = foods;

    if (normalizedFilter) {
      if (normalizedFilter.startsWith('vitamina:')) {
        const vitaminName = normalizedFilter.substring(9).trim();
        results = vitaminName ? foods.filter(f => f.food_vitamins?.some(v => v.vitamins?.name && normalizeSearchText(v.vitamins.name).includes(vitaminName))) : foods;
      } else if (normalizedFilter.startsWith('mineral:')) {
        const mineralName = normalizedFilter.substring(8).trim();
        results = mineralName ? foods.filter(f => f.food_minerals?.some(m => m.minerals?.name && normalizeSearchText(m.minerals.name).includes(mineralName))) : foods;
      } else if (normalizedFilter.startsWith('temporada:')) {
        const seasonName = normalizedFilter.substring(10).trim();
        results = seasonName ? foods.filter(f => f.seasons?.some(s => s && s.name && normalizeSearchText(s.name).includes(seasonName))) : foods;
      } else if (normalizedFilter.startsWith('sensibilidad:')) {
          const sensitivityName = normalizedFilter.substring(13).trim();
          results = sensitivityName ? foods.filter(f => f.food_sensitivities?.some(a => a.sensitivities?.name && normalizeSearchText(a.sensitivities.name).includes(sensitivityName))) : foods;
      } else {
        results = foods.filter(food =>
          food.name && normalizeSearchText(food.name).includes(normalizedFilter)
        );
      }
    }
    
    return results.slice(0, 10);
    
  }, [searchTerm, combinedFoods, excludeSensitivities, userSensitivities]);

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
                {searchTerm.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreateFoodClick}
                    className="border-dashed border-emerald-500 text-emerald-300 bg-emerald-900/20 hover:bg-emerald-500/20 hover:text-emerald-200"
                  >
                    Crear "{searchTerm.trim()}"
                  </Button>
                )}
              </div>
            )}
          </AnimatePresence>
        )}
      </FoodLookupPanel>
      <CreateFoodInlineDialog
        open={isCreateFoodOpen}
        onOpenChange={setIsCreateFoodOpen}
        userId={userId || user?.id}
        foodToCreate={foodToCreate}
        onFoodCreated={handleFoodCreated}
        description="Completa el formulario simplificado para añadir este alimento."
      />
    </div>
  );
};

export default FoodSearch;
