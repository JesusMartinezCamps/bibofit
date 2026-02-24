
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import MacroDistribution from '@/components/plans/constructor/MacroDistribution';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useOnboardingContext } from '@/contexts/OnboardingContext';

const MealMacroDistributionStep = ({ onNext, isLoading }) => {
  const { user } = useAuth();
  const { onboardingState } = useOnboardingContext();
  const { toast } = useToast();
  
  // Initialize with user's TDEE if available, otherwise default to 2000
  const [dailyCalories, setDailyCalories] = useState(user?.tdee_kcal || 2000);
  // Task 7: Initialize from onboardingState (persisted data)
  const [macros, setMacros] = useState(onboardingState?.macroDistribution || { protein: 30, carbs: 40, fat: 30 });
  const [overrides, setOverrides] = useState([]);
  
  // Task 2: Validation state
  const [isValid, setIsValid] = useState(false);

  // Sync with user profile if it loads late or updates
  useEffect(() => {
    if (user?.tdee_kcal) {
        setDailyCalories(prev => (prev === 2000 && user.tdee_kcal !== 2000) ? user.tdee_kcal : prev);
    }
  }, [user?.tdee_kcal]);
  
  // Task 4: Validate before advancing
  const handleNext = () => {
    if (!isValid) {
        toast({
            title: "Error de validación",
            description: "Los porcentajes deben sumar exactamente 100% para continuar.",
            variant: "destructive"
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
        <div className="text-center space-y-2 mb-6">
          <p className="text-gray-400">Define tus objetivos nutricionales base.</p>
        </div>

        <MacroDistribution
            effectiveTdee={dailyCalories}
            calculatedTdee={user?.tdee_kcal || 2000}
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
                        setDailyCalories(user?.tdee_kcal || 2000);
                    }
                }
            }}
            isTemplate={false}
            readOnly={false}
            isOffline={true} 
            userId={user?.id}
            supabase={supabase}
            onValidationChange={setIsValid} // Task 1 & 2 handling
        />
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button 
            onClick={handleNext} 
            // Task 2: Disable button when invalid
            disabled={isLoading || !isValid}
            className={`w-full h-12 text-lg shadow-lg ${!isValid ? 'bg-gray-600 cursor-not-allowed opacity-70' : 'bg-green-600 hover:bg-green-700 shadow-green-900/20 text-white'}`}
        >
            {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2"/> Guardando...</>
            ) : 'Siguiente'}
        </Button>
        {/* Task 2: Explicit error message if they try to interact or just visual cue */}
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
