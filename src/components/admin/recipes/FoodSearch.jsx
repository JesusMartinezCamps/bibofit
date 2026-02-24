import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import FoodCard from '@/components/admin/recipes/FoodCard';
import { useAuth } from '@/contexts/AuthContext';

const normalizeString = (str) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const FoodSearch = ({ onSelectFood, selectedFoodId, onActionComplete, excludeSensitivities = [], userId, refreshTrigger }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allFoods, setAllFoods] = useState([]);
  const [userCreatedFoods, setUserCreatedFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userSensitivities, setUserSensitivities] = useState([]);
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

      let foodQuery = supabase
        .from('food')
        .select(`
          id, name, proteins, total_carbs, total_fats, food_unit,
          food_to_seasons(season(name)),
          food_to_food_groups(food_groups(id, name)),
          food_vitamins(vitamins(id, name)),
          food_minerals(minerals(id, name)),
          food_sensitivities(sensitivities(id, name))
        `);

      const [
        { data: foodsData, error: foodsError },
        { data: userFoodsData, error: userFoodsError },
        userSensitivityIds
      ] = await Promise.all([
        foodQuery.order('name', { ascending: true }),
        targetUserId ? supabase
          .from('user_created_foods')
          .select(`
            id, name, proteins, total_carbs, total_fats, food_unit,
            user_created_food_to_food_groups(food_groups(id, name)),
            season:season_id(name),
            user_created_food_sensitivities(sensitivities(id, name)),
            user_created_food_vitamins(vitamins(id, name)),
            user_created_food_minerals(minerals(id, name))
          `)
          .eq('user_id', targetUserId)
          .in('status', ['approved_private', 'pending'])
          .order('name', { ascending: true }) : Promise.resolve({ data: [], error: null }),
        fetchUserSensitivities()
      ]);

      if (foodsError) throw foodsError;
      if (userFoodsError) {
          console.error("Supabase error:", JSON.stringify(userFoodsError, null, 2));
          toast({
              title: "Error de Supabase",
              description: `Fetch error from user_created_foods: ${userFoodsError.message}`,
              variant: "destructive"
          });
          throw userFoodsError;
      }


      const transformedFoods = (foodsData || []).map(food => ({
        ...food,
        carbs: food.total_carbs,
        fats: food.total_fats,
        food_groups: food.food_to_food_groups?.map(ftfg => ftfg.food_groups).filter(Boolean) || [],
        seasons: food.food_to_seasons?.map(fts => fts.season).filter(Boolean) || [],
      }));

      const transformedUserFoods = (userFoodsData || []).map(userFood => ({
        ...userFood,
        food_groups: userFood.user_created_food_to_food_groups?.map(item => item.food_groups).filter(Boolean) || [],
        seasons: userFood.season ? [userFood.season] : [],
        food_sensitivities: userFood.user_created_food_sensitivities || [],
        food_vitamins: userFood.user_created_food_vitamins || [],
        food_minerals: userFood.user_created_food_minerals || [],
        isUserCreated: true
      }));

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
  
  const handleDeleteFood = async (foodIdToDelete) => {
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

  const handleKeyDown = (e, food) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSelectFood(food);
    }
  };

  const handleFoodClick = (food) => {
    onSelectFood(food);
  };

  const combinedFoods = useMemo(() => {
    return [...allFoods, ...userCreatedFoods];
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
    
    const normalizedFilter = normalizeString(searchTerm.toLowerCase().trim());
    
    let results = foods;

    if (normalizedFilter) {
      if (normalizedFilter.startsWith('vitamina:')) {
        const vitaminName = normalizedFilter.substring(9).trim();
        results = vitaminName ? foods.filter(f => f.food_vitamins?.some(v => v.vitamins?.name && normalizeString(v.vitamins.name.toLowerCase()).includes(vitaminName))) : foods;
      } else if (normalizedFilter.startsWith('mineral:')) {
        const mineralName = normalizedFilter.substring(8).trim();
        results = mineralName ? foods.filter(f => f.food_minerals?.some(m => m.minerals?.name && normalizeString(m.minerals.name.toLowerCase()).includes(mineralName))) : foods;
      } else if (normalizedFilter.startsWith('temporada:')) {
        const seasonName = normalizedFilter.substring(10).trim();
        results = seasonName ? foods.filter(f => f.seasons?.some(s => s && s.name && normalizeString(s.name.toLowerCase()).includes(seasonName))) : foods;
      } else if (normalizedFilter.startsWith('sensibilidad:')) {
          const sensitivityName = normalizedFilter.substring(13).trim();
          results = sensitivityName ? foods.filter(f => f.food_sensitivities?.some(a => a.sensitivities?.name && normalizeString(a.sensitivities.name.toLowerCase()).includes(sensitivityName))) : foods;
      } else {
        results = foods.filter(food =>
          food.name && normalizeString(food.name.toLowerCase()).includes(normalizedFilter)
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
      <div className="relative mb-4">
        <Input
          type="text"
          placeholder={placeholderText}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field pr-10"
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="relative flex-grow overflow-y-auto pr-2">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-green-500" />
          </div>
        ) : (
          <AnimatePresence>
            {filteredFoods.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {filteredFoods.map((food) => (
                  <div
                    key={`${food.isUserCreated ? 'user' : 'food'}-${food.id}`}
                    onClick={() => handleFoodClick(food)}
                    onKeyDown={(e) => handleKeyDown(e, food)}
                    tabIndex={0}
                    className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-lg"
                  >
                    <FoodCard
                      food={food}
                      onSelect={onSelectFood}
                      isSelected={selectedFoodId === food.id}
                      onDelete={isCoach ? null : (food.isUserCreated ? null : handleDeleteFood)}
                    />
                  </div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center text-gray-400 py-4">
                {searchTerm ? 'No se encontraron resultados.' : 'No hay alimentos en la base de datos.'}
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default FoodSearch;