import React, { useState } from 'react';
import { assignDietPlanToUser } from '@/lib/dietAssignmentService';
import { useToast } from '@/components/ui/use-toast';

export const useOnboardingDietAssignment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const assignDietFromOnboarding = async (userId, onboardingData) => {
    setLoading(true);
    setError(null);

    try {
      const { 
        macrosPct, 
        meals,
        template,
        planName,
        dailyCalories
      } = onboardingData;

      // 1. Calculate Daily Grams based on TDEE and Global Ratios
      const dailyProteins = Math.round((dailyCalories * (macrosPct.protein / 100)) / 4);
      const dailyCarbs = Math.round((dailyCalories * (macrosPct.carbs / 100)) / 4);
      const dailyFats = Math.round((dailyCalories * (macrosPct.fat / 100)) / 9);

      // 2. Build Meals Array with Calculated Targets
      const calculatedMeals = meals.map(meal => {
        // Calculate grams for this meal based on its share of the daily total
        const target_proteins = Math.round(dailyProteins * (meal.protein_pct / 100));
        const target_carbs = Math.round(dailyCarbs * (meal.carbs_pct / 100));
        const target_fats = Math.round(dailyFats * (meal.fat_pct / 100));
        
        // Calculate calories for this meal from its macros
        const target_calories = (target_proteins * 4) + (target_carbs * 4) + (target_fats * 9);
        
        // Return meal with populated targets
        return {
            ...meal,
            target_calories,
            target_proteins,
            target_carbs,
            target_fats
        };
      });

      // Calculate dates
      const now = new Date();
      const startDate = now.toISOString().split('T')[0];
      const endDate = new Date(now.setFullYear(now.getFullYear() + 100)).toISOString().split('T')[0];

      // 3. Construct Final Plan Data
      const planData = {
        planName: planName || "Mi Plan de Nutrición",
        startDate: startDate,
        endDate: endDate,
        template: template,
        dailyCalories: dailyCalories,
        globalMacros: macrosPct || { protein: 30, carbs: 40, fat: 30 },
        mealMacroDistribution: calculatedMeals,
        overrides: [] 
      };

      // 4. Create Plan via Service
      const result = await assignDietPlanToUser(userId, planData, true);

      if (!result.success) {
        throw new Error(result.error?.message || "Error desconocido al asignar el plan.");
      }

      return { success: true, planId: result.planId };

    } catch (err) {
      setError(err.message);
      
      toast({
        title: "Error al crear el plan",
        description: React.createElement(
          "div",
          { className: "flex flex-col gap-1" },
          React.createElement("span", null, "Hubo un problema procesando tus datos."),
          React.createElement("span", { className: "text-xs opacity-90 font-mono bg-red-900/30 p-1 rounded" }, err.message)
        ),
        variant: "destructive",
        duration: 5000,
      });
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  return {
    assignDietFromOnboarding,
    loading,
    error
  };
};