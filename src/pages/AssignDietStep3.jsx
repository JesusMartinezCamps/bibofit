
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft, Rocket } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import MealMacroConfiguration from '@/components/plans/constructor/MealMacroConfiguration';
import { assignDietPlanToUser } from '@/lib/dietAssignmentService';
import { useNavigate } from 'react-router-dom';
import LoadingScreen from '@/components/shared/LoadingScreen';

const AssignDietStep3 = ({ 
  onPrevious, 
  userDayMeals = [], 
  dailyCalories = 2000,
  initialMealMacros,
  planData,
  updateData 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [mealsData, setMealsData] = useState([]);

  useEffect(() => {
    let mounted = true;
    
    const loadMeals = async () => {
      let baseMeals = userDayMeals;

      // If props empty, fetch from DB
      if (!baseMeals || baseMeals.length === 0) {
        setLoadingMeals(true);
        try {
           const { data, error } = await supabase
            .from('user_day_meals')
            .select('*, day_meal:day_meals(name, display_order)')
            .eq('user_id', user.id)
             .order('display_order',
              {
                foreignTable: 'day_meals', ascending: true
              });

           if (error) throw error;
           if (data) {
             baseMeals = data.sort((a, b) => {
               const orderA = Array.isArray(a.day_meals) ? a.day_meals[0]?.display_order : a.day_meals?.display_order;
               const orderB = Array.isArray(b.day_meals) ? b.day_meals[0]?.display_order : b.day_meals?.display_order;
               return (orderA || 0) - (orderB || 0);
             });
           }
        } catch (error) {
           console.error("Error loading meals:", error);
        } finally {
           if (mounted) setLoadingMeals(false);
        }
      }
      
      // Fix: Ensure mock data has valid day_meal_id references for the flow to work in admin view
      if ((!baseMeals || baseMeals.length === 0) && (user.role === 'admin' || user.role === 'coach')) {
           baseMeals = [
                { id: 'mock-1', day_meal_id: 1, day_meals: { name: 'Desayuno', display_order: 1 } },
                { id: 'mock-2', day_meal_id: 2, day_meals: { name: 'Almuerzo', display_order: 2 } },
                { id: 'mock-3', day_meal_id: 3, day_meals: { name: 'Cena', display_order: 3 } }
           ];
      }

      if (!mounted) return;

      if (baseMeals && baseMeals.length > 0) {
        const preparedMeals = baseMeals.map(meal => {
            const dayMealRel = meal.day_meals;
            const dayMealObj = Array.isArray(dayMealRel) ? dayMealRel[0] : dayMealRel;
            const name = dayMealObj?.name || 'Comida';
            
            return {
                ...meal,
                day_meal: { ...dayMealObj, name } 
            };
        });

        if (initialMealMacros && initialMealMacros.length === preparedMeals.length) {
            setMealsData(initialMealMacros);
        } else {
            const count = preparedMeals.length;
            const evenCaloriePct = Math.floor(100 / count);
            const remainder = 100 - (evenCaloriePct * count);

            const initialized = preparedMeals.map((meal, index) => ({
                id: meal.id,
                day_meal_id: meal.day_meal_id, 
                mealId: meal.id,
                day_meal: meal.day_meals, 
                protein_pct: 30,
                carbs_pct: 40,
                fat_pct: 30,
                caloriePercentage: index === 0 ? evenCaloriePct + remainder : evenCaloriePct,
            }));
            
            const evenSplit = Math.floor(100 / count);
            const splitRemainder = 100 - (evenSplit * count);
            
            const distributed = initialized.map((m, i) => ({
                ...m,
                protein_pct: i === 0 ? evenSplit + splitRemainder : evenSplit,
                carbs_pct: i === 0 ? evenSplit + splitRemainder : evenSplit,
                fat_pct: i === 0 ? evenSplit + splitRemainder : evenSplit
            }));
            
            setMealsData(distributed);
        }
      }
    };

    loadMeals();

    return () => {
      mounted = false;
    };
  }, [userDayMeals, user.id, toast, initialMealMacros, user.role]);

  const handleMealConfigChange = (updatedMeals) => {
    setMealsData(updatedMeals);
  };

  const handleCreateDiet = async () => {
    setIsAssigning(true);

    const dailyTotalGrams = {
        protein: Math.round((dailyCalories * (planData.macroDistribution.protein / 100)) / 4),
        carbs: Math.round((dailyCalories * (planData.macroDistribution.carbs / 100)) / 4),
        fat: Math.round((dailyCalories * (planData.macroDistribution.fat / 100)) / 9)
    };

    const mappedForSave = mealsData.map(m => ({
        mealId: m.id,
        day_meal_id: m.day_meal_id || m.day_meal?.id, 
        mealName: m.day_meal?.name,
        protein_pct: m.protein_pct,
        carbs_pct: m.carbs_pct,
        fat_pct: m.fat_pct,
        target_proteins: Math.round(dailyTotalGrams.protein * (m.protein_pct / 100)),
        target_carbs: Math.round(dailyTotalGrams.carbs * (m.carbs_pct / 100)),
        target_fats: Math.round(dailyTotalGrams.fat * (m.fat_pct / 100)),
        target_calories: 
            (Math.round(dailyTotalGrams.protein * (m.protein_pct / 100)) * 4) + 
            (Math.round(dailyTotalGrams.carbs * (m.carbs_pct / 100)) * 4) + 
            (Math.round(dailyTotalGrams.fat * (m.fat_pct / 100)) * 9)
    }));

    const finalPlanData = {
        ...planData,
        mealMacroDistribution: mappedForSave
    };
    updateData({ mealMacroDistribution: mappedForSave });

    try {
        const result = await assignDietPlanToUser(user.id, finalPlanData, false); 

        if (result.success) {
            setTimeout(() => {
                navigate('/plan/dieta');
            }, 500);
        } else {
            setIsAssigning(false);
            toast({
                title: "Error al crear la dieta",
                description: result.error?.message || "Hubo un problema inesperado.",
                variant: "destructive"
            });
        }
    } catch (error) {
        setIsAssigning(false);
        toast({
            title: "Error crítico",
            description: "No se pudo conectar con el servidor.",
            variant: "destructive"
        });
    }
  };

  return (
    <>
        <AnimatePresence>
            {isAssigning && (
                <LoadingScreen message="Bibofit está configurando tu nueva dieta..." />
            )}
        </AnimatePresence>

        <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">
        <div className="text-center space-y-2 mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Distribución de Macros por Momento</h1>
            <p className="text-gray-400 text-sm md:text-base">Ajusta qué porcentaje de tus macros diarios irá a cada comida.</p>
        </div>

        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="transition-all duration-300"
        >
            <MealMacroConfiguration
                meals={mealsData}
                effectiveTdee={dailyCalories}
                macrosPct={planData.macroDistribution} 
                shouldAutoExpand={true}
                hideSaveButton={true} 
                onChange={handleMealConfigChange}
                readOnly={false}
                forceUnlock={true}
            />
        </motion.div>

        <div className="flex flex-col-reverse sm:flex-row justify-between pt-4 gap-3">
            <Button 
                variant="outline"
                onClick={onPrevious}
                disabled={isAssigning}
                className="border-gray-600 text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white px-6 py-6 w-full sm:w-auto"
            >
                <ArrowLeft className="mr-2 w-5 h-5" />
                Atrás
            </Button>

            <Button 
                onClick={handleCreateDiet}
                disabled={isAssigning}
                className="bg-green-600 hover:bg-green-500 text-white px-8 py-6 text-lg w-full sm:w-auto shadow-lg shadow-green-900/20"
            >
                {isAssigning ? "Creando..." : "Crear Dieta"}
                <Rocket className="ml-2 w-5 h-5" />
            </Button>
        </div>
        </div>
    </>
  );
};

export default AssignDietStep3;
