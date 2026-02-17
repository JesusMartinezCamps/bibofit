import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import MacroDistribution from '@/components/plans/constructor/MacroDistribution';
import { supabase } from '@/lib/supabaseClient';

const MealMacroDistributionStep = ({ onNext, isLoading }) => {
  const { user } = useAuth();
  
  // Initialize with user's TDEE if available, otherwise default to 2000
  const [dailyCalories, setDailyCalories] = useState(user?.tdee_kcal || 2000);
  const [macros, setMacros] = useState({ protein: 30, carbs: 40, fat: 30 });
  const [overrides, setOverrides] = useState([]);

  // Sync with user profile if it loads late or updates
  useEffect(() => {
    if (user?.tdee_kcal) {
        // Only update if we haven't set a manual override locally in this session yet
        // or if we just want to ensure we start with the profile value
        setDailyCalories(prev => (prev === 2000 && user.tdee_kcal !== 2000) ? user.tdee_kcal : prev);
    }
  }, [user?.tdee_kcal]);
  
  const handleNext = () => {
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
                    // Immediately update effective calories for the UI
                    setDailyCalories(change.data.manual_calories);
                } else if (change.type === 'delete') {
                    setOverrides(prev => prev.filter(o => o.id !== change.id));
                    // Revert to calculated TDEE if all overrides removed
                    // (Simplified logic: in a real app we'd find the next valid override)
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
        />
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button 
            onClick={handleNext} 
            disabled={isLoading}
            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
        >
            {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2"/> Guardando...</>
            ) : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
};

export default MealMacroDistributionStep;