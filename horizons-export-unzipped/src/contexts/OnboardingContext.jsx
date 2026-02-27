import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { onboardingService } from '@/lib/onboarding/onboardingService';
import { ONBOARDING_STEPS } from '@/lib/onboarding/onboardingConfig';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

export const OnboardingContext = createContext(null);

export const OnboardingProvider = ({ children }) => {
  const { user, refreshUser } = useAuth(); 
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentStepId, setCurrentStepId] = useState(ONBOARDING_STEPS[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isRepeatingOnboarding, setIsRepeatingOnboarding] = useState(false);
  const [repeatDraftData, setRepeatDraftData] = useState({});
  const [repeatBaselineSnapshot, setRepeatBaselineSnapshot] = useState(null);

  // New State for exposed data
  const [onboardingState, setOnboardingState] = useState({
      dailyCalories: 2000,
      macroDistribution: { protein: 30, carbs: 40, fat: 30 },
      userDayMeals: []
  });

  // Task 3: Helper function to save step ID to DB
  const saveOnboardingStep = useCallback(async (stepId) => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_step_id: stepId })
        .eq('user_id', user.id);
    } catch (err) {
      console.error("Error saving onboarding step:", err);
      // Optional: show silent error toast if needed, but keeping it non-blocking
    }
  }, [user]);

  // Helper to refresh onboarding state data
  const refreshOnboardingState = useCallback(async () => {
      if (!user) return;
      try {
          // Fetch progress to get macro distribution and calories
          const { data: progress } = await supabase
             .from('assignment_progress')
             .select('plan_data')
             .eq('user_id', user.id)
             .single();
          
          // Fetch user day meals
          const { data: meals } = await supabase
             .from('user_day_meals')
             .select('*')
             .eq('user_id', user.id);

          const planData = progress?.plan_data || {};

          setOnboardingState({
              dailyCalories: planData.dailyCalories || user.tdee_kcal || 2000,
              macroDistribution: planData.macroDistribution || { protein: 30, carbs: 40, fat: 30 },
              userDayMeals: meals || []
          });

      } catch (e) {
          // Error silently handled
      }
  }, [user]);

  // Check initial status
  useEffect(() => {
    if (!user) {
      setIsOpen(false);
      return;
    }

    let mounted = true;

    const init = async () => {
      try {
        if (mounted) setIsLoading(true);
        const status = await onboardingService.getOnboardingStatus(user.id);
        
        // Initial state load
        await refreshOnboardingState();
        
        if (mounted) {
          if (status && status.onboarding_completed_at) {
             setIsOnboardingCompleted(true);
             setIsOpen(false);
          } else {
             // Task 6: Set initial step from DB
             if (status && status.onboarding_step_id) {
               const stepExists = ONBOARDING_STEPS.find(s => s.id === status.onboarding_step_id);
               if (stepExists) {
                  setCurrentStepId(status.onboarding_step_id);
               } else {
                  setCurrentStepId(ONBOARDING_STEPS[0].id);
               }
             } else {
               setCurrentStepId(ONBOARDING_STEPS[0].id);
             }
             
             setIsOnboardingCompleted(false);
             setIsOpen(true);
          }
        }
      } catch (err) {
        if (mounted) setError('Error loading onboarding progress');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    init();
    return () => { mounted = false; };
  }, [user, refreshOnboardingState]);

  const currentStepIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStepId);
  const safeIndex = currentStepIndex === -1 ? 0 : currentStepIndex;
  const currentStep = ONBOARDING_STEPS[safeIndex];
  
  const isFirstStep = safeIndex === 0;
  const isLastStep = safeIndex === ONBOARDING_STEPS.length - 1;

  const captureRepeatBaselineSnapshot = useCallback(async () => {
    if (!user?.id) return null;

    const [
      profileRes,
      dietPreferencesRes,
      userDayMealsRes,
      userSensitivitiesRes,
      userMedicalConditionsRes,
      preferredFoodsRes,
      nonPreferredFoodsRes,
      assignmentProgressRes,
      overridesRes,
      dietPlansRes
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, phone, birth_date, sex, height_cm, current_weight_kg, activity_level_id, tdee_kcal, onboarding_step_id')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('diet_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_day_meals')
        .select('*')
        .eq('user_id', user.id)
        .is('diet_plan_id', null),
      supabase
        .from('user_sensitivities')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('user_medical_conditions')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('preferred_foods')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('non_preferred_foods')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('assignment_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('diet_plan_calorie_overrides')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('diet_plans')
        .select('id, is_active')
        .eq('user_id', user.id)
        .eq('is_template', false)
    ]);

    const queryErrors = [
      profileRes.error,
      dietPreferencesRes.error,
      userDayMealsRes.error,
      userSensitivitiesRes.error,
      userMedicalConditionsRes.error,
      preferredFoodsRes.error,
      nonPreferredFoodsRes.error,
      assignmentProgressRes.error,
      overridesRes.error,
      dietPlansRes.error
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      throw queryErrors[0];
    }

    return {
      profile: profileRes.data || null,
      dietPreferences: dietPreferencesRes.data || null,
      userDayMeals: userDayMealsRes.data || [],
      userSensitivities: userSensitivitiesRes.data || [],
      userMedicalConditions: userMedicalConditionsRes.data || [],
      preferredFoods: preferredFoodsRes.data || [],
      nonPreferredFoods: nonPreferredFoodsRes.data || [],
      assignmentProgress: assignmentProgressRes.data || null,
      overrides: overridesRes.data || [],
      dietPlans: dietPlansRes.data || []
    };
  }, [user?.id]);

  const restoreRepeatBaselineSnapshot = useCallback(async () => {
    if (!user?.id || !repeatBaselineSnapshot) return;

    const snapshot = repeatBaselineSnapshot;

    const { profile } = snapshot;
    if (profile) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name ?? '',
          phone: profile.phone ?? null,
          birth_date: profile.birth_date ?? null,
          sex: profile.sex ?? null,
          height_cm: profile.height_cm ?? null,
          current_weight_kg: profile.current_weight_kg ?? null,
          activity_level_id: profile.activity_level_id ?? null,
          tdee_kcal: profile.tdee_kcal ?? null,
          onboarding_step_id: profile.onboarding_step_id || 'completion'
        })
        .eq('user_id', user.id);

      if (error) throw error;
    }

    await supabase.from('diet_preferences').delete().eq('user_id', user.id);
    if (snapshot.dietPreferences) {
      const { error } = await supabase
        .from('diet_preferences')
        .insert(snapshot.dietPreferences);
      if (error) throw error;
    }

    await supabase.from('user_day_meals').delete().eq('user_id', user.id).is('diet_plan_id', null);
    if (snapshot.userDayMeals.length > 0) {
      const { error } = await supabase.from('user_day_meals').insert(snapshot.userDayMeals);
      if (error) throw error;
    }

    await supabase.from('user_sensitivities').delete().eq('user_id', user.id);
    if (snapshot.userSensitivities.length > 0) {
      const { error } = await supabase.from('user_sensitivities').insert(snapshot.userSensitivities);
      if (error) throw error;
    }

    await supabase.from('user_medical_conditions').delete().eq('user_id', user.id);
    if (snapshot.userMedicalConditions.length > 0) {
      const { error } = await supabase.from('user_medical_conditions').insert(snapshot.userMedicalConditions);
      if (error) throw error;
    }

    await supabase.from('preferred_foods').delete().eq('user_id', user.id);
    if (snapshot.preferredFoods.length > 0) {
      const { error } = await supabase.from('preferred_foods').insert(snapshot.preferredFoods);
      if (error) throw error;
    }

    await supabase.from('non_preferred_foods').delete().eq('user_id', user.id);
    if (snapshot.nonPreferredFoods.length > 0) {
      const { error } = await supabase.from('non_preferred_foods').insert(snapshot.nonPreferredFoods);
      if (error) throw error;
    }

    if (snapshot.assignmentProgress) {
      const { error } = await supabase
        .from('assignment_progress')
        .upsert(snapshot.assignmentProgress, { onConflict: 'user_id' });
      if (error) throw error;
    } else {
      await supabase.from('assignment_progress').delete().eq('user_id', user.id);
    }

    await supabase.from('diet_plan_calorie_overrides').delete().eq('user_id', user.id);
    if (snapshot.overrides.length > 0) {
      const { error } = await supabase
        .from('diet_plan_calorie_overrides')
        .insert(snapshot.overrides);
      if (error) throw error;
    }

    const snapshotPlanMap = new Map(snapshot.dietPlans.map(plan => [plan.id, plan.is_active]));
    const { data: currentPlans, error: currentPlansError } = await supabase
      .from('diet_plans')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('is_template', false);

    if (currentPlansError) throw currentPlansError;

    for (const currentPlan of currentPlans || []) {
      const desiredState = snapshotPlanMap.has(currentPlan.id) ? snapshotPlanMap.get(currentPlan.id) : false;
      if (currentPlan.is_active === desiredState) continue;

      const { error } = await supabase
        .from('diet_plans')
        .update({ is_active: desiredState })
        .eq('id', currentPlan.id)
        .eq('user_id', user.id);
      if (error) throw error;
    }
  }, [repeatBaselineSnapshot, user?.id]);

  const nextStep = useCallback(async (data = null) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isRepeatingOnboarding) {
        const hasDataToSave = data && Object.keys(data).length > 0;
        if (hasDataToSave) {
          setRepeatDraftData(prev => ({ ...prev, [currentStep.id]: data }));
        }
        if (currentStep.nextStepId) {
          setCurrentStepId(currentStep.nextStepId);
        }
        return true;
      }

      const hasDataToSave = data && Object.keys(data).length > 0;
      const tableName = currentStep.tableName;

      if (hasDataToSave && tableName) {
        await onboardingService.saveStepData(user.id, currentStep.id, data, tableName);
      } else {
        await onboardingService.saveStepData(user.id, currentStep.id, {}, 'profiles');
      }

      await refreshUser();
      await refreshOnboardingState();

      if (currentStep.nextStepId) {
        await saveOnboardingStep(currentStep.nextStepId);
        setCurrentStepId(currentStep.nextStepId);
      }
      return true;
    } catch (err) {
      setError(err.message || 'Error saving data');
      toast({
          title: "Error de conexión",
          description: "No se pudo guardar el progreso. Inténtalo de nuevo.",
          variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentStep, user, refreshUser, refreshOnboardingState, toast, isRepeatingOnboarding, saveOnboardingStep]);

  const previousStep = useCallback(async () => {
    const currentIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStepId);
    if (currentIndex > 0) {
      const prevStep = ONBOARDING_STEPS[currentIndex - 1];

      if (isRepeatingOnboarding) {
        setCurrentStepId(prevStep.id);
        return;
      }

      setIsLoading(true);
      try {
        await saveOnboardingStep(prevStep.id);
        setCurrentStepId(prevStep.id);
      } catch (error) {
        console.error("Error going back:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [currentStepId, saveOnboardingStep, isRepeatingOnboarding]);

  const closeOnboardingModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const startRepeatOnboarding = useCallback(async () => {
    if (!user?.id) return false;

    try {
      setError(null);
      const status = await onboardingService.getOnboardingStatus(user.id);
      const hasCompletedAtLeastOnce = Boolean(status?.onboarding_completed_at);

      if (!hasCompletedAtLeastOnce) {
        toast({
          title: "Onboarding no completado",
          description: "Debes completar el onboarding al menos una vez antes de repetirlo.",
          variant: "destructive"
        });
        return false;
      }

      setIsOnboardingCompleted(true);
      setCurrentStepId(ONBOARDING_STEPS[0].id);
      setIsOpen(true);
      return true;
    } catch (err) {
      setError(err.message || 'Error iniciando repetición de onboarding');
      toast({
        title: "Error",
        description: "No se pudo iniciar la repetición del onboarding.",
        variant: "destructive"
      });
      return false;
    }
  }, [toast, user?.id]);

  const cancelOnboarding = useCallback(async () => {
    try {
      setIsLoading(true);
      if (isRepeatingOnboarding) {
        await restoreRepeatBaselineSnapshot();
      }

      const completionUpdates = {
        onboarding_step_id: 'completion'
      };

      if (!isOnboardingCompleted) {
        completionUpdates.onboarding_completed_at = new Date().toISOString();
      }

      const { error: completionError } = await supabase
        .from('profiles')
        .update(completionUpdates)
        .eq('user_id', user.id);

      if (completionError) throw completionError;

      await refreshUser();
      await refreshOnboardingState();
      setIsOnboardingCompleted(true);
      setCurrentStepId(ONBOARDING_STEPS[0].id);
      setRepeatDraftData({});
      setRepeatBaselineSnapshot(null);
      setIsRepeatingOnboarding(false);
      setIsOpen(false);
    } catch (err) {
      setError(err.message || 'Error cancelando onboarding');
      toast({
        title: "Error",
        description: "No se pudieron descartar los cambios del onboarding.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [isOnboardingCompleted, isRepeatingOnboarding, refreshOnboardingState, refreshUser, restoreRepeatBaselineSnapshot, toast, user?.id]);

  const jumpToMealAdjustment = useCallback(() => {
    if (!isRepeatingOnboarding) return false;
    setCurrentStepId('meal-adjustment');
    return true;
  }, [isRepeatingOnboarding]);

  const completeOnboarding = useCallback(async () => {
    if (!user) return false;
    
    try {
      setIsLoading(true);

      if (isRepeatingOnboarding) {
        for (const step of ONBOARDING_STEPS) {
          const pendingData = repeatDraftData[step.id];
          if (!pendingData || Object.keys(pendingData).length === 0) continue;
          await onboardingService.saveStepData(user.id, step.id, pendingData, step.tableName || 'profiles');
        }
      }
      
      // Update BOTH onboarding_completed_at and onboarding_step_id to 'completion'
      const updates = {
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step_id: 'completion'
      };

      const { error: dbError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      // Refresh final state
      await refreshUser();
      
      setIsOnboardingCompleted(true);
      setIsRepeatingOnboarding(false);
      setRepeatDraftData({});
      setRepeatBaselineSnapshot(null);
      navigate('/dashboard');
      closeOnboardingModal();
      
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, closeOnboardingModal, navigate, refreshUser, isRepeatingOnboarding, repeatDraftData]);

  useEffect(() => {
    if (!isOpen || !isOnboardingCompleted || isRepeatingOnboarding || !user?.id) return;

    let isMounted = true;
    const initRepeatSession = async () => {
      try {
        const snapshot = await captureRepeatBaselineSnapshot();
        if (!isMounted) return;
        setRepeatBaselineSnapshot(snapshot);
        setRepeatDraftData({});
        setCurrentStepId(ONBOARDING_STEPS[0].id);
        setIsRepeatingOnboarding(true);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Error iniciando repetición de onboarding');
        setIsOpen(false);
        toast({
          title: "Error",
          description: "No se pudo iniciar la repetición del onboarding.",
          variant: "destructive"
        });
      }
    };

    initRepeatSession();
    return () => {
      isMounted = false;
    };
  }, [isOpen, isOnboardingCompleted, isRepeatingOnboarding, user?.id, captureRepeatBaselineSnapshot, toast]);

  const value = {
    currentStep,
    currentStepIndex: safeIndex,
    totalSteps: ONBOARDING_STEPS.length,
    isFirstStep,
    isLastStep,
    isLoading,
    error,
    isOnboardingCompleted,
    hasCompletedOnboardingOnce: isOnboardingCompleted,
    isOpen,
    setIsOpen,
    nextStep,
    previousStep,
    completeOnboarding,
    closeOnboardingModal,
    cancelOnboarding,
    startRepeatOnboarding,
    jumpToMealAdjustment,
    isOnboardingActive: isOpen,
    isRepeatingOnboarding,
    onboardingState, // Exposed State
    refreshOnboardingState, // Helper if needed manually
    saveOnboardingStep // Exposed helper
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboardingContext = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboardingContext must be used within an OnboardingProvider');
  }
  return context;
};
