import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import MacroDistribution from '@/components/plans/constructor/MacroDistribution';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useOnboardingContext } from '@/contexts/OnboardingContext';
import {
  GOAL_DIRECTION_OPTIONS,
  calculateGoalAdjustedCalories
} from '@/lib/dietGoalAdjustment';

const fetchDietPreferences = async (userId) => {
  const preferred = await supabase
    .from('diet_preferences')
    .select('diet_goal_id, calorie_adjustment_pct, calorie_adjustment_direction')
    .eq('user_id', userId)
    .maybeSingle();

  if (!preferred.error) return preferred;

  return supabase
    .from('diet_preferences')
    .select('diet_goal_id')
    .eq('user_id', userId)
    .maybeSingle();
};

const fetchDietGoal = async (goalId) => {
  if (!goalId) return { data: null, error: null };

  const preferred = await supabase
    .from('diet_goals')
    .select(
      'id, name, description, energy_adjustment_direction, default_adjustment_pct, min_adjustment_pct, max_adjustment_pct'
    )
    .eq('id', goalId)
    .maybeSingle();

  if (!preferred.error) return preferred;

  return supabase
    .from('diet_goals')
    .select('id, name, description')
    .eq('id', goalId)
    .maybeSingle();
};

const getDirectionLabel = (direction) => {
  if (direction === GOAL_DIRECTION_OPTIONS.DEFICIT) return 'reduccion calorica';
  if (direction === GOAL_DIRECTION_OPTIONS.SURPLUS) return 'aumento calorico';
  return 'mantenimiento';
};

const MealMacroDistributionStep = ({ onNext, isLoading }) => {
  const { user } = useAuth();
  const { onboardingState } = useOnboardingContext();
  const { toast } = useToast();

  const initialCalories = onboardingState?.dailyCalories || user?.tdee_kcal || 2000;
  const [dailyCalories, setDailyCalories] = useState(initialCalories);
  const [macros, setMacros] = useState(onboardingState?.macroDistribution || { protein: 30, carbs: 40, fat: 30 });
  const [overrides, setOverrides] = useState([]);
  const [isValid, setIsValid] = useState(false);
  const [recommendedCalories, setRecommendedCalories] = useState(user?.tdee_kcal || 2000);
  const [goalSummary, setGoalSummary] = useState(null);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const loadGoalAdjustment = async () => {
      try {
        const prefRes = await fetchDietPreferences(user.id);
        const preference = prefRes.data || {};
        const goalRes = await fetchDietGoal(preference?.diet_goal_id);
        const goal = goalRes.data || null;

        const calculation = calculateGoalAdjustedCalories({
          tdeeKcal: user?.tdee_kcal,
          sex: user?.sex,
          goalRow: goal,
          direction: preference?.calorie_adjustment_direction,
          adjustmentPct: preference?.calorie_adjustment_pct
        });

        if (!mounted) return;

        const targetCalories = calculation.targetCaloriesKcal || user?.tdee_kcal || 2000;
        setRecommendedCalories(targetCalories);
        setGoalSummary({
          goalName: goal?.name || 'Mantenimiento',
          direction: calculation.direction,
          adjustmentPct: calculation.adjustmentPct,
          deltaKcal: calculation.deltaKcal,
          baseTdeeKcal: calculation.baseTdeeKcal,
          targetCaloriesKcal: calculation.targetCaloriesKcal,
          minCaloriesGuardrailApplied: calculation.minCaloriesGuardrailApplied,
          minCaloriesGuardrailKcal: calculation.minCaloriesGuardrailKcal
        });

        setDailyCalories((prev) => {
          const persistedCalories = Number(onboardingState?.dailyCalories);
          if (Number.isFinite(persistedCalories) && persistedCalories > 0) {
            return persistedCalories;
          }

          if (prev !== 2000 && prev !== (user?.tdee_kcal || 2000)) {
            return prev;
          }

          return targetCalories;
        });
      } catch (error) {
        console.error('Error loading goal adjustment for macro distribution:', error);
      }
    };

    loadGoalAdjustment();

    return () => {
      mounted = false;
    };
  }, [user?.id, user?.tdee_kcal, user?.sex, onboardingState?.dailyCalories]);

  useEffect(() => {
    if (user?.tdee_kcal && !goalSummary) {
      setDailyCalories((prev) => (prev === 2000 && user.tdee_kcal !== 2000 ? user.tdee_kcal : prev));
    }
  }, [user?.tdee_kcal, goalSummary]);

  const handleNext = () => {
    if (!isValid) {
      toast({
        title: 'Error de validación',
        description: 'Los porcentajes deben sumar exactamente 100% para continuar.',
        variant: 'destructive'
      });
      return;
    }

    onNext({
      dailyCalories,
      macroDistribution: macros,
      overrides
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pr-1">
        {goalSummary?.baseTdeeKcal && (
          <div className="mb-4 rounded-xl border border-border bg-card/40 p-4 text-sm space-y-1">
            <p className="text-muted-foreground">
              Calorias base (mantenimiento):{' '}
              <span className="font-semibold text-foreground">~{goalSummary.baseTdeeKcal} kcal</span>
            </p>
            <p className="text-muted-foreground">
              Objetivo aplicado ({getDirectionLabel(goalSummary.direction)}):{' '}
              <span className="font-semibold text-foreground">~{recommendedCalories} kcal</span>
              {goalSummary.direction !== GOAL_DIRECTION_OPTIONS.MAINTENANCE && (
                <span className="ml-2 text-muted-foreground">
                  ({goalSummary.adjustmentPct}% | {goalSummary.deltaKcal > 0 ? '+' : ''}{goalSummary.deltaKcal} kcal)
                </span>
              )}
            </p>
            {goalSummary.minCaloriesGuardrailApplied && (
              <p className="text-xs text-yellow-300">
                Bibofit aplico un guardarrail para no bajar de {goalSummary.minCaloriesGuardrailKcal} kcal/dia.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Puedes ajustar este valor manualmente prefieres otro punto de partida.
            </p>
          </div>
        )}

        <MacroDistribution
            effectiveTdee={dailyCalories}
            calculatedTdee={recommendedCalories}
            macrosPct={macros}
            onMacrosPctChange={setMacros}
            onCaloriesChange={setDailyCalories}
            calorieOverrides={overrides}
            onOfflineChange={(change) => {
                if (change.type === 'add') {
                    setOverrides(prev => [...prev, change.data]);
                    setDailyCalories(change.data.manual_calories);
                } else if (change.type === 'delete') {
                    setOverrides(prev => prev.filter(o => o.id !== change.id));
                    if (overrides.length <= 1) {
                        setDailyCalories(recommendedCalories);
                    }
                }
            }}
            isTemplate={false}
            readOnly={false}
            isOffline={true} 
            userId={user?.id}
            supabase={supabase}
            onValidationChange={setIsValid}
        />
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button 
            onClick={handleNext} 
            disabled={isLoading || !isValid}
            className={`w-full h-12 text-lg shadow-lg ${!isValid ? 'bg-gray-600 cursor-not-allowed opacity-70' : 'bg-green-600 hover:bg-green-700 shadow-green-900/20 text-white'}`}
        >
            {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2"/> Guardando...</>
            ) : 'Siguiente'}
        </Button>
        {!isValid && (
            <p className="text-center text-red-400 text-sm mt-2">
                Los porcentajes deben sumar exactamente 100%
            </p>
        )}
      </div>
    </div>
  );
};

export default MealMacroDistributionStep;
