import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Rocket } from 'lucide-react';
import MealMacroConfiguration from '@/components/plans/constructor/MealMacroConfiguration';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useOnboardingDietAssignment } from '@/hooks/useOnboardingDietAssignment';
import ConflictResolutionDialog from '@/components/admin/diet-plans/ConflictResolutionDialog';
import LoadingScreen from '@/components/shared/LoadingScreen';
import { getConflictInfo } from '@/lib/restrictionChecker';

const MealAdjustmentStep = ({ onNext, isLoading: isStepLoading }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Use the new hook for assignment logic
  const { assignDietFromOnboarding, prepareConflictResolutionData, loading: assignmentLoading } = useOnboardingDietAssignment();

  const [loading, setLoading] = useState(true);
  const [isGeneratingScreen, setIsGeneratingScreen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("¡Calculando tu dieta personalizada! 🔥");
  const [planData, setPlanData] = useState(null);
  const [meals, setMeals] = useState([]);
  
  // Local macros pct state for configuration
  const [macrosPct, setMacrosPct] = useState({ protein: 30, carbs: 40, fat: 30 });
  const [dailyCalories, setDailyCalories] = useState(2000);
  const [conflicts, setConflicts] = useState({});
  const [clientRestrictions, setClientRestrictions] = useState({ sensitivities: [], conditions: [] });
  const [planRestrictionsForEditor, setPlanRestrictionsForEditor] = useState({ sensitivities: [], conditions: [] });
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [recipeOverrides, setRecipeOverrides] = useState(new Map());

  const fetchDefaultTemplate = async () => {
    const { data, error } = await supabase
      .from('diet_plans')
      .select('id, name, protein_pct, carbs_pct, fat_pct')
      .eq('name', 'Mi última dieta')
      .eq('is_template', true)
      .limit(1);

    if (error) {
      console.error("Error fetching default template 'Mi última dieta':", error);
      return null;
    }

    return data?.[0] || null;
  };

  const ensureTemplate = async (sourcePlanData = planData) => {
    const existingTemplate = sourcePlanData?.selectedTemplate || sourcePlanData?.template;
    if (existingTemplate) return existingTemplate;

    const fallbackTemplate = await fetchDefaultTemplate();
    if (!fallbackTemplate) return null;

    const mergedPlanData = {
      ...(sourcePlanData || {}),
      template: fallbackTemplate,
      selectedTemplate: sourcePlanData?.selectedTemplate || fallbackTemplate
    };

    setPlanData(mergedPlanData);

    try {
      await supabase
        .from('assignment_progress')
        .upsert({
          user_id: user.id,
          plan_data: mergedPlanData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Error persisting fallback template in assignment_progress:', e);
    }

    return fallbackTemplate;
  };

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

        let data = progress?.plan_data || {};

        if (!data.selectedTemplate && !data.template) {
          const fallbackTemplate = await fetchDefaultTemplate();
          if (fallbackTemplate) {
            data = {
              ...data,
              template: fallbackTemplate,
              selectedTemplate: fallbackTemplate
            };
          }
        }

        setPlanData(data);
        
        // Initialize state from fetched data
        if (data.dailyCalories) setDailyCalories(data.dailyCalories);
        if (data.macroDistribution) setMacrosPct(data.macroDistribution);
        else if (data.macros) setMacrosPct(data.macros);
        
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

        const baseMacroDistribution = data.macroDistribution || data.macros || { protein: 30, carbs: 40, fat: 30 };

        if (dbMeals && dbMeals.length > 0) {
            const uniqueMealsMap = new Map();
            
            dbMeals.forEach(m => {
                if (!uniqueMealsMap.has(m.day_meal_id)) {
                    uniqueMealsMap.set(m.day_meal_id, {
                        id: m.id,
                        name: m.day_meals?.name || 'Comida',
                        day_meal_id: m.day_meal_id,
                        protein_pct: m.protein_pct || baseMacroDistribution.protein || 30, 
                        carbs_pct: m.carbs_pct || baseMacroDistribution.carbs || 40,
                        fat_pct: m.fat_pct || baseMacroDistribution.fat || 30,
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

  const updateRecipeInState = (updatedRecipe) => {
      setRecipeOverrides(prev => {
          const next = new Map(prev);
          next.set(updatedRecipe.id, updatedRecipe);
          return next;
      });

      setConflicts(prev => {
          const criticalTypes = new Set(['condition_avoid', 'sensitivity', 'non-preferred']);
          const ingredients = updatedRecipe?.custom_ingredients?.length > 0
              ? updatedRecipe.custom_ingredients
              : (updatedRecipe?.ingredients || updatedRecipe?.recipe?.recipe_ingredients || []);

          const activeConflictReasons = new Set();
          ingredients.forEach((ing) => {
              const info = getConflictInfo(ing?.food, clientRestrictions);
              if (info && criticalTypes.has(info.type)) {
                  activeConflictReasons.add(info.reason || 'Conflicto');
              }
          });

          const newConflicts = { ...prev };
          Object.keys(newConflicts).forEach(key => {
              newConflicts[key] = newConflicts[key].filter(r => r.id !== updatedRecipe.id);
              if (newConflicts[key].length === 0) {
                  delete newConflicts[key];
              }
          });

          activeConflictReasons.forEach((reason) => {
              if (!newConflicts[reason]) newConflicts[reason] = [];
              if (!newConflicts[reason].some((r) => r.id === updatedRecipe.id)) {
                  newConflicts[reason].push(updatedRecipe);
              }
          });

          return newConflicts;
      });
  };

  const runAssignment = async (template, localRecipeOverrides = null) => {
      setIsGeneratingScreen(true);
      setLoadingMessage("¡Calculando tu dieta personalizada! 🔥");
      
      const startTime = Date.now();
      let isSuccess = false;

      // Deactivate existing active plans before creating the new one
      try {
          const { data: activePlans, error: fetchError } = await supabase
              .from('diet_plans')
              .select('id')
              .eq('user_id', user.id)
              .eq('is_active', true);
              
          if (!fetchError && activePlans && activePlans.length > 0) {
              await supabase
                  .from('diet_plans')
                  .update({ is_active: false })
                  .in('id', activePlans.map(p => p.id));
          }
      } catch (e) {
          console.error("Error deactivating existing plans:", e);
      }

      try {
        const clientName = user?.full_name?.trim();
        const planName = clientName ? `Dieta de ${clientName}` : 'Dieta de Cliente';

        const result = await assignDietFromOnboarding(user.id, {
            dailyCalories,
            macrosPct,
            meals,
            template,
            recipeOverrides: localRecipeOverrides,
            planName
        });

        if (result && result.success) {
            isSuccess = true;
        } else {
            throw new Error("No se pudo crear el plan.");
        }
      } catch (err) {
          console.error("Assignment Error:", err);
          setLoadingMessage("⚠️ Hubo un problema procesando tu plan.");
          // Wait briefly to show error before hiding
          await new Promise(resolve => setTimeout(resolve, 2000));
          setIsGeneratingScreen(false);
          return;
      }

      // Ensure minimum 2.5 seconds of display duration for visual impact
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 2500 - elapsedTime);
      
      if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      if (isSuccess && onNext) {
          // Do not set isGeneratingScreen to false here, let the component unmount naturally
          // to prevent flickering before CompletionStep mounts
          toast({
              title: "¡Plan Creado y Balanceado!",
              description: "Tu plan de nutrición ha sido asignado y optimizado correctamente."
          });
          onNext(); 
      } else {
          setIsGeneratingScreen(false);
      }
  };

  const handleConflictResolutionComplete = async () => {
      setIsConflictModalOpen(false);
      const template = await ensureTemplate(planData);
      if (!template) return;

      await runAssignment(template, recipeOverrides);
  };

  const handleFinish = async () => {
    if (!planData) {
         toast({ title: "Error", description: "Faltan datos del plan. Recarga la página.", variant: "destructive" });
         return;
    }

    const template = await ensureTemplate(planData);
    
    if (!template) {
        toast({ title: "Error", description: "No se ha seleccionado una plantilla base.", variant: "destructive" });
        return;
    }

    try {
        const conflictData = await prepareConflictResolutionData({
            userId: user.id,
            template
        });

        setClientRestrictions(conflictData.clientRestrictions);
        setPlanRestrictionsForEditor(conflictData.planRestrictionsForEditor);
        setRecipeOverrides(conflictData.recipeOverrides);
        
        if ((conflictData.autoSubstitutionsApplied || []).length > 0) {
            toast({
                title: "Sustituciones automáticas aplicadas",
                description: `Se ajustaron ${(conflictData.autoSubstitutionsApplied || []).length} ingredientes según tus restricciones.`
            });
        }

        if (Object.keys(conflictData.conflicts).length > 0) {
            setConflicts(conflictData.conflicts);
            setIsConflictModalOpen(true);
            return;
        }

        await runAssignment(template, conflictData.recipeOverrides);
    } catch (err) {
        toast({ title: "Error", description: "Hubo un error al preparar los datos. Intenta nuevamente.", variant: "destructive" });
    }
  };

  if (isGeneratingScreen) {
      return (
          <LoadingScreen 
            isVisible={true} 
            message={loadingMessage} 
            submessage="Alineando tus macros y optimizando ingredientes..." 
          />
      );
  }

  return (
    <>
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-green-500 mb-4" />
            <p className="text-gray-400">Cargando configuración...</p>
        </div>
      ) : (
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
                    <><Loader2 className="w-4 h-4 animate-spin mr-2"/> Generando Plan...</>
                ) : (
                    <><Rocket className="w-5 h-5 mr-2" /> Finalizar y Crear Plan</>
                )}
            </Button>
          </div>
        </div>
      )}

      <ConflictResolutionDialog
          open={isConflictModalOpen}
          onOpenChange={setIsConflictModalOpen}
          conflicts={conflicts}
          onRecipeUpdate={updateRecipeInState}
          onResolveComplete={handleConflictResolutionComplete}
          clientRestrictions={clientRestrictions}
          planRestrictions={planRestrictionsForEditor}
      />
    </>
  );
};

export default MealAdjustmentStep;
