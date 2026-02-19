import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Rocket } from 'lucide-react';
import MealMacroConfiguration from '@/components/plans/constructor/MealMacroConfiguration';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useOnboardingContext } from '@/contexts/OnboardingContext';
import { useToast } from '@/components/ui/use-toast';
import { useOnboardingDietAssignment } from '@/hooks/useOnboardingDietAssignment';
import { useNavigate } from 'react-router-dom';

const MealAdjustmentStep = ({ isLoading: isStepLoading }) => {
  const { user } = useAuth();
  const { completeOnboarding } = useOnboardingContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Use the new hook for assignment logic
  const { assignDietFromOnboarding, loading: assignmentLoading } = useOnboardingDietAssignment();
  
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState(null);
  const [meals, setMeals] = useState([]);
  
  // Local macros pct state for configuration
  const [macrosPct, setMacrosPct] = useState({ protein: 30, carbs: 40, fat: 30 });
  const [dailyCalories, setDailyCalories] = useState(2000);

  // Fetch data accumulated in previous steps and DB meals
  useEffect(() => {
    if (!user) return;

    const loadPlanData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch assignment progress for base plan data
        const { data: progress, error: progressError } = await supabase
          .from('assignment_progress')
          .select('plan_data')
          .eq('user_id', user.id)
          .single();

        if (progressError && progressError.code !== 'PGRST116') {
             // Error silently handled or logged if critical
        }

        const data = progress?.plan_data || {};

        setPlanData(data);
        
        // Initialize state from fetched data
        if (data.dailyCalories) setDailyCalories(data.dailyCalories);
        if (data.macroDistribution) setMacrosPct(data.macroDistribution);
        
        // 2. Fetch User Day Meals from DB (Priority over assignment_progress for meals)
        const { data: dbMeals, error: mealsError } = await supabase
            .from('user_day_meals')
            .select(`
                id,
                day_meal_id,
                protein_pct,
                carbs_pct,
                fat_pct,
                diet_plan_id,
                day_meals (
                    id,
                    name,
                    display_order
                )
            `)
            .eq('user_id', user.id)
            .is('diet_plan_id', null) // Ensure we only get base profile meals
            .order('day_meal_id'); 

        if (mealsError) {
            throw mealsError;
        }

        let mealsToSet = [];

        if (dbMeals && dbMeals.length > 0) {
            const uniqueMealsMap = new Map();
            
            dbMeals.forEach(m => {
                if (!uniqueMealsMap.has(m.day_meal_id)) {
                    uniqueMealsMap.set(m.day_meal_id, {
                        id: m.id,
                        name: m.day_meals?.name || 'Comida',
                        day_meal_id: m.day_meal_id,
                        protein_pct: m.protein_pct || data.macroDistribution?.protein || 30, 
                        carbs_pct: m.carbs_pct || data.macroDistribution?.carbs || 40,
                        fat_pct: m.fat_pct || data.macroDistribution?.fat || 30,
                        day_meal: m.day_meals
                    });
                }
            });

            const uniqueMeals = Array.from(uniqueMealsMap.values());
            
            // Sort by display order
            mealsToSet = uniqueMeals.sort((a, b) => 
                (a.day_meal?.display_order || 0) - (b.day_meal?.display_order || 0)
            );
            
        } else if (data.mealMacroDistribution && data.mealMacroDistribution.length > 0) {
             mealsToSet = data.mealMacroDistribution;
        } else {
             mealsToSet = [
                { id: '1', name: 'Desayuno', protein_pct: 30, carbs_pct: 40, fat_pct: 30 },
                { id: '2', name: 'Almuerzo', protein_pct: 35, carbs_pct: 35, fat_pct: 30 },
                { id: '3', name: 'Cena', protein_pct: 35, carbs_pct: 25, fat_pct: 40 }
             ];
        }

        setMeals(mealsToSet);

      } catch (err) {
        toast({ title: "Error", description: "Error cargando datos de configuración.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    loadPlanData();
  }, [user, toast]);

  const handleFinish = async () => {
    if (!planData) {
         toast({ title: "Error", description: "Faltan datos del plan. Recarga la página.", variant: "destructive" });
         return;
    }

    const template = planData.selectedTemplate || planData.template;
    
    if (!template) {
        toast({ title: "Error", description: "No se ha seleccionado una plantilla base.", variant: "destructive" });
        return;
    }

    // Task 2: Verify success before completing onboarding
    try {
        // 1. Call the assignment service (which triggers Edge Function)
        const result = await assignDietFromOnboarding(user.id, {
            dailyCalories,
            macrosPct,
            meals,
            template,
            planName: "Mi Plan de Nutrición" 
        });

        // 2. Check result success strictly
        if (result && result.success) {
            
            toast({ 
                title: "¡Plan Creado y Balanceado!", 
                description: "Tu plan de nutrición ha sido asignado y optimizado correctamente." 
            });

            // 3. ONLY now complete onboarding
            const completeSuccess = await completeOnboarding();
            
            if (!completeSuccess) {
                // Optional: show a specific error if onboarding completion fails
                toast({
                    title: "Advertencia",
                    description: "El plan se creó, pero hubo un problema actualizando tu perfil. Por favor contacta soporte.",
                    variant: "warning"
                });
            }
        } else {
            // Do NOT call completeOnboarding() here. 
            // The hook assignDietFromOnboarding already shows an error toast.
        }
    } catch (err) {
        // Do NOT close onboarding on error
    }
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-green-500 mb-4" />
              <p className="text-gray-400">Cargando configuración...</p>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pr-1 space-y-6">
        <div className="text-center space-y-2 mb-4">
          <p className="text-gray-400">
             Revisa la distribución de macros para tus comidas. 
             Cuando estés listo, finaliza para generar tu plan.
          </p>
        </div>

        {/* Meal Configuration Component */}
        <MealMacroConfiguration
            meals={meals}
            effectiveTdee={dailyCalories}
            macrosPct={macrosPct}
            shouldAutoExpand={true}
            hideSaveButton={true}
            readOnly={assignmentLoading}
            forceUnlock={true}
            onChange={(newMeals) => setMeals(newMeals)}
        />
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button 
            onClick={handleFinish} 
            disabled={assignmentLoading || isStepLoading}
            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
        >
            {assignmentLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2"/> Optimizando y Creando Plan...</>
            ) : (
                <><Rocket className="w-5 h-5 mr-2" /> Finalizar y Crear Plan</>
            )}
        </Button>
      </div>
    </div>
  );
};

export default MealAdjustmentStep;