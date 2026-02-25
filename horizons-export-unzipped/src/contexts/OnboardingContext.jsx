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

  // New State for exposed data
  const [onboardingState, setOnboardingState] = useState({
      dailyCalories: 2000,
      macroDistribution: { protein: 30, carbs: 40, fat: 30 },
      userDayMeals: []
  });

  // Task 3: Helper function to save step ID to DB
  const saveOnboardingStep = async (stepId) => {
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
  };

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
  }, [user?.id, refreshOnboardingState]);

  const currentStepIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStepId);
  const safeIndex = currentStepIndex === -1 ? 0 : currentStepIndex;
  const currentStep = ONBOARDING_STEPS[safeIndex];
  
  const isFirstStep = safeIndex === 0;
  const isLastStep = safeIndex === ONBOARDING_STEPS.length - 1;

  const nextStep = useCallback(async (data = null) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const hasDataToSave = data && Object.keys(data).length > 0;
      const tableName = currentStep.tableName;

      // 1. Save Step Data
      if (hasDataToSave && tableName) {
        await onboardingService.saveStepData(user.id, currentStep.id, data, tableName);
      } else {
        await onboardingService.saveStepData(user.id, currentStep.id, {}, 'profiles');
      }

      await refreshUser();
      await refreshOnboardingState(); // Refresh local state after step save

      // 2. Advance to next step and save ID
      if (currentStep.nextStepId) {
        // Task 3: Call helper to save step ID to DB before updating local state
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
  }, [currentStep, user, refreshUser, refreshOnboardingState, toast]);

  const previousStep = useCallback(async () => {
    const currentIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStepId);
    if (currentIndex > 0) {
      const prevStep = ONBOARDING_STEPS[currentIndex - 1];
      
      // Task 5: Save previous step ID to DB when going back
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
  }, [currentStepId]);

  const closeOnboardingModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (!user) return false;
    
    try {
      setIsLoading(true);
      
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
      navigate('/dashboard');
      closeOnboardingModal();
      
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, closeOnboardingModal, navigate, refreshUser]);

  const value = {
    currentStep,
    currentStepIndex: safeIndex,
    totalSteps: ONBOARDING_STEPS.length,
    isFirstStep,
    isLastStep,
    isLoading,
    error,
    isOnboardingCompleted,
    isOpen,
    setIsOpen,
    nextStep,
    previousStep,
    completeOnboarding,
    closeOnboardingModal,
    isOnboardingActive: isOpen,
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