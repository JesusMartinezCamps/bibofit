import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import MacroDistribution from '@/components/plans/constructor/MacroDistribution';

const AssignDietStep2 = ({ 
  onNext, 
  profile,
  dailyCalories = 2000,
  initialMacros,
  updateData,
  planData,
  userId,
  supabase
}) => {
  // Handle calorie changes from the nested CalorieAdjustment component
  const handleCaloriesChange = (newCalories) => {
    updateData({ dailyCalories: newCalories });
  };

  const handleMacrosChange = (newMacros) => {
    updateData({ macroDistribution: newMacros });
  };

  // Offline handler for CalorieAdjustment
  const handleOfflineOverrideChange = (action) => {
      const currentOverrides = planData?.overrides || [];
      let newOverrides = [...currentOverrides];
      
      if (action.type === 'add') {
          newOverrides.unshift(action.data); // Add to front as newest
      } else if (action.type === 'delete') {
          newOverrides = newOverrides.filter(o => o.id !== action.id);
      }
      
      updateData({ overrides: newOverrides });
      
      // Update effective calories immediately based on new overrides (first item is newest)
      const active = newOverrides.length > 0 ? newOverrides[0] : null;
        
      if (active) {
          updateData({ dailyCalories: active.manual_calories });
      } else {
          // Revert to profile base TDEE if no overrides active
          if (profile?.tdee_kcal) {
              updateData({ dailyCalories: profile.tdee_kcal });
          }
      }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Configuración de Dieta</h1>
        <p className="text-gray-400 text-sm md:text-base">Define tu objetivo calórico y la distribución de macronutrientes.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="transition-all duration-300 space-y-6"
      >
        <MacroDistribution
            effectiveTdee={dailyCalories}
            calculatedTdee={profile?.tdee_kcal || 2000}
            macrosPct={initialMacros}
            onMacrosPctChange={handleMacrosChange}
            onCaloriesChange={handleCaloriesChange}
            calorieOverrides={planData?.overrides || []}
            onOfflineChange={handleOfflineOverrideChange}
            isTemplate={false}
            readOnly={false}
            isOffline={true} 
            userId={userId}
            supabase={supabase}
        />
      </motion.div>

      <div className="flex flex-col-reverse sm:flex-row justify-end pt-4 gap-3">
        <Button 
            onClick={onNext}
            className="bg-green-600 hover:bg-green-500 text-white px-8 py-6 text-lg w-full sm:w-auto"
        >
            Siguiente
            <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default AssignDietStep2;