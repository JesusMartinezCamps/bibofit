
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { addYears } from 'date-fns';
import { Loader2 } from 'lucide-react';

import AssignDietStep2 from '@/pages/AssignDietStep2';
import AssignDietStep3 from '@/pages/AssignDietStep3';
import { loadAssignmentProgress, saveAssignmentProgress } from '@/lib/assignmentProgressService';

const AssignDietPlanPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // -- STATE MANAGEMENT --
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // Additional Data
  const [userDayMeals, setUserDayMeals] = useState([]);
  const [profile, setProfile] = useState(null);

  // Plan Data
  const [planData, setPlanData] = useState({
    template: null,
    planName: "Mi última dieta",
    clientId: null,
    startDate: new Date(),
    endDate: addYears(new Date(), 100),
    dailyCalories: 2000,
    overrides: [],
    macroDistribution: { protein: 30, carbs: 40, fat: 30 },
    mealMacroDistribution: []
  });

  const isFirstRun = useRef(true);

  // -- LOAD PROGRESS --
  useEffect(() => {
    const init = async () => {
      if (!user) return;
      
      console.group("AssignDietPlanPage Init");
      console.log("Loading data for user:", user.id);
      
      try {
        // 1. Check existing active plan (UNIFIED FOR ALL ROLES)
        const { data: activePlans } = await supabase
           .from('diet_plans')
           .select('id')
           .eq('user_id', user.id)
           .eq('is_active', true)
           .eq('is_template', false);
           
        if (activePlans && activePlans.length > 0) {
            console.log("User already has active plan, redirecting to dashboard");
            navigate('/dashboard');
            return;
        }

        // 2. Load User Day Meals
        const { data: meals, error: mealsError } = await supabase
            .from('user_day_meals')
            .select(`
                *,
                day_meals (
                    name,
                    display_order
                )
            `)
            .eq('user_id', user.id)
            .order('day_meal_id', { ascending: true });
        
        if (mealsError) {
             console.error("Error fetching day meals:", mealsError);
        }

        if (meals && meals.length > 0) {
            const sortedMeals = meals.sort((a, b) => (a.day_meals?.display_order || 0) - (b.day_meals?.display_order || 0));
            setUserDayMeals(sortedMeals);
        } else {
             console.log("No meals found, using defaults");
             setUserDayMeals([
                { id: 'default-1', day_meals: { name: 'Desayuno', display_order: 1 } },
                { id: 'default-2', day_meals: { name: 'Almuerzo', display_order: 2 } },
                { id: 'default-3', day_meals: { name: 'Cena', display_order: 3 } }
             ]);
        }
        
        // 3. Fetch template
        const { data: template } = await supabase
            .from('diet_plans')
            .select('*')
            .eq('name', 'Mi última dieta')
            .eq('is_template', true)
            .maybeSingle();

        // 4. Fetch Profile TDEE (Removed tour_step_id)
        const { data: fetchedProfile } = await supabase
            .from('profiles')
            .select('tdee_kcal, user_id')
            .eq('user_id', user.id)
            .single();

        setProfile(fetchedProfile);
        const profileTdee = fetchedProfile?.tdee_kcal || 2000;

        let initialPlanData = {
             template: template,
             planName: "Mi última dieta",
             clientId: user.id,
             startDate: new Date(),
             endDate: addYears(new Date(), 100),
             dailyCalories: profileTdee, 
             overrides: [],
             macroDistribution: { 
                protein: template?.protein_pct || 30, 
                carbs: template?.carbs_pct || 40, 
                fat: template?.fat_pct || 30 
             },
             mealMacroDistribution: []
        };
        
        // 5. Determine Current Step from Saved Progress
        let resolvedStep = 1;
        
        try {
            const savedProgress = await loadAssignmentProgress(user.id);
            if (savedProgress) {
                resolvedStep = savedProgress.current_step || 1;
                if (savedProgress.plan_data && Object.keys(savedProgress.plan_data).length > 0) {
                    const merged = { ...initialPlanData, ...savedProgress.plan_data };
                    if (!merged.dailyCalories) merged.dailyCalories = profileTdee;
                    if (typeof merged.startDate === 'string') merged.startDate = new Date(merged.startDate);
                    if (typeof merged.endDate === 'string') merged.endDate = new Date(merged.endDate);
                    if (!merged.template) merged.template = template; 
                    initialPlanData = merged;
                }
            }
        } catch (err) {
            console.warn("Could not load saved progress:", err);
        }

        setPlanData(initialPlanData);
        setCurrentStep(resolvedStep);

      } catch (error) {
          console.error("Error initializing assignment page:", error);
          toast({
              title: "Error al cargar",
              description: "Hubo un problema cargando tus datos. Por favor intenta recargar.",
              variant: "destructive"
          });
      } finally {
          setIsLoading(false);
          isFirstRun.current = false;
          console.groupEnd();
      }
    };
    init();
  }, [user, navigate, toast]);

  // -- SAVE PROGRESS --
  useEffect(() => {
    if (isLoading || isFirstRun.current || !user || currentStep > 2) return;
    
    const save = async () => {
        await saveAssignmentProgress(user.id, currentStep, true, true, planData);
    };
    
    const timeoutId = setTimeout(save, 500);
    return () => clearTimeout(timeoutId);

  }, [currentStep, planData, user, isLoading]);

  // -- HANDLERS --
  const handleAssignatorNext = async () => {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
  };
  
  const handleAssignatorPrevious = async () => {
     if (currentStep > 1) {
        const prevStep = currentStep - 1;
        setCurrentStep(prevStep);
    } 
  };

  // Determine effective calories
  // Find latest created override
  const activeOverride = planData.overrides.sort((a, b) => new Date(b.created_at || new Date()) - new Date(a.created_at || new Date()))[0];
  const effectiveCalories = activeOverride ? activeOverride.manual_calories : planData.dailyCalories;

  if (isLoading) {
      return (
          <div className="min-h-screen bg-[#1a1e23] flex flex-col items-center justify-center text-white gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-green-500" />
              <p className="text-gray-400">Cargando tu configuración...</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#1a1e23] text-white p-4 sm:p-8 relative overflow-y-auto overflow-x-hidden">
        
        {/* Progress Indicator */}
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-10 flex flex-col items-end gap-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest hidden sm:block">
                Paso {currentStep} de 2
            </div>
            <div className="flex gap-1">
                {[1, 2].map(step => (
                    <div 
                        key={step} 
                        className={`h-1.5 w-6 sm:w-8 rounded-full transition-colors duration-300 ${
                            step <= currentStep ? 'bg-green-500' : 'bg-gray-700'
                        }`}
                    />
                ))}
            </div>
        </div>

        <div className={`w-full max-w-5xl mx-auto transition-all duration-500`}>
            
            {currentStep === 1 && (
                <AssignDietStep2 
                    onNext={handleAssignatorNext}
                    onPrevious={handleAssignatorPrevious}
                    dailyCalories={effectiveCalories}
                    initialMacros={planData.macroDistribution}
                    updateData={(newData) => setPlanData(prev => ({ ...prev, ...newData }))}
                    profile={profile}
                    planData={planData}
                    userId={user?.id}
                    supabase={supabase}
                />
            )}

            {currentStep === 2 && (
                <AssignDietStep3 
                    onPrevious={handleAssignatorPrevious}
                    userDayMeals={userDayMeals}
                    dailyCalories={effectiveCalories}
                    initialMealMacros={planData.mealMacroDistribution}
                    planData={planData}
                    updateData={(newData) => setPlanData(prev => ({ ...prev, ...newData }))}
                />
            )}
        </div>
    </div>
  );
};

export default AssignDietPlanPage;
