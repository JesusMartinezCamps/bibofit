import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Apple, Plus, Clock, Target } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const NutritionPanel = ({ selectedDate }) => {
  const [meals, setMeals] = useState([]);
  const [dailyGoals, setDailyGoals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const loadNutritionData = async () => {
      if (!user) return;
      setLoading(true);
      const dateKey = selectedDate.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nutrition_entries')
        .select('meals, daily_goals')
        .eq('user_id', user.id)
        .eq('date', dateKey)
        .single();

      if (data) {
        setMeals(data.meals || []);
        setDailyGoals(data.daily_goals || { calories: 0, protein: 0, carbs: 0, fat: 0 });
      } else {
        setMeals([]);
        setDailyGoals({ calories: 2000, protein: 150, carbs: 200, fat: 70 }); // Default goals
      }
      setLoading(false);
    };

    loadNutritionData();
  }, [selectedDate, user]);

  const addMeal = () => {
    toast({
      title: "Agregar comida",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  const calculateTotals = () => {
    if (!meals) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return meals.reduce((totals, meal) => {
      meal.foods.forEach(food => {
        totals.calories += food.calories;
        totals.protein += food.protein;
        totals.carbs += food.carbs;
        totals.fat += food.fat;
      });
      return totals;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const totals = calculateTotals();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
        <div className="flex items-center justify-center space-x-3 mb-4"><Apple className="w-8 h-8 text-[#5ebe7d]" /><h2 className="text-3xl font-bold text-white">Plan Nutricional</h2></div>
        <p className="text-gray-400">{selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </motion.div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Cargando plan nutricional...</div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="glass-effect rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center"><Target className="w-5 h-5 text-[#5ebe7d] mr-2" />Resumen Diario</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Calorías', current: totals.calories, goal: dailyGoals.calories, unit: 'kcal' },
                { label: 'Proteína', current: totals.protein, goal: dailyGoals.protein, unit: 'g' },
                { label: 'Carbohidratos', current: totals.carbs, goal: dailyGoals.carbs, unit: 'g' },
                { label: 'Grasas', current: totals.fat, goal: dailyGoals.fat, unit: 'g' }
              ].map((macro) => (
                <div key={macro.label} className="bg-[#1a1e23] rounded-lg p-4">
                  <p className="text-gray-400 text-sm">{macro.label}</p>
                  <p className="text-2xl font-bold text-white">{Math.round(macro.current)}<span className="text-sm text-gray-400">/{macro.goal}{macro.unit}</span></p>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2"><div className="bg-[#5ebe7d] h-2 rounded-full transition-all duration-300" style={{ width: `${Math.min((macro.current / macro.goal) * 100, 100)}%` }}></div></div>
                </div>
              ))}
            </div>
          </motion.div>

          {meals.length > 0 ? (
            <div className="space-y-6">
              {meals.map((meal, index) => (
                <motion.div key={meal.id || index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }} className="glass-effect rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3"><Clock className="w-5 h-5 text-[#5ebe7d]" /><h3 className="text-xl font-semibold text-white">{meal.name}</h3><span className="text-gray-400">{meal.time}</span></div>
                    <Button onClick={addMeal} size="sm" className="btn-secondary"><Plus className="w-4 h-4 mr-2" />Agregar</Button>
                  </div>
                  <div className="space-y-3">
                    {meal.foods.map((food, foodIndex) => (
                      <div key={foodIndex} className="bg-[#1a1e23] rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-white">{food.name}</h4>
                            <div className="flex space-x-4 text-sm text-gray-400 mt-1"><span>{food.calories} kcal</span><span>P: {food.protein}g</span><span>C: {food.carbs}g</span><span>G: {food.fat}g</span></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-effect rounded-2xl p-8 text-center">
              <Apple className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Sin plan nutricional</h3>
              <p className="text-gray-400">No hay un plan de nutrición asignado para este día.</p>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }} className="text-center">
            <Button onClick={addMeal} className="btn-primary"><Plus className="w-5 h-5 mr-2" />Agregar Nueva Comida</Button>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default NutritionPanel;