import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { onboardingService } from '@/lib/onboarding/onboardingService';
import { ONBOARDING_STEPS } from '@/lib/onboarding/onboardingConfig';
import { isMobile as checkIsMobile } from '@/lib/isMobile';

export const useOnboarding = () => {
  const { user } = useAuth();
  const [currentStepId, setCurrentStepId] = useState(ONBOARDING_STEPS[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(checkIsMobile());
  const [error, setError] = useState(null);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(checkIsMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const init = async () => {
      try {
        if (mounted) setIsLoading(true);
        console.log('🔄 [useOnboarding] Fetching initial status for user:', user.id);
        const status = await onboardingService.getOnboardingStatus(user.id);
        
        if (mounted && status) {
          if (status.onboarding_completed_at) {
             console.log('✅ [useOnboarding] User has already completed onboarding.');
             setIsOnboardingCompleted(true);
          }

          if (status.onboarding_step_id) {
            const stepExists = ONBOARDING_STEPS.find(s => s.id === status.onboarding_step_id);
            if (stepExists && !status.onboarding_completed_at) {
               console.log('✅ [useOnboarding] Restoring step:', status.onboarding_step_id);
               setCurrentStepId(status.onboarding_step_id);
            } else {
               console.log('ℹ️ [useOnboarding] User completed onboarding or step invalid, starting fresh.');
            }
          }
        }
      } catch (err) {
        console.error('❌ [useOnboarding] Error loading progress:', err);
        if (mounted) setError('Error loading onboarding progress');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    init();
    return () => { mounted = false; };
  }, [user]);

  const currentStepIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStepId);
  const currentStep = ONBOARDING_STEPS[currentStepIndex] || ONBOARDING_STEPS[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === ONBOARDING_STEPS.length - 1;

  const nextStep = useCallback(async (data = null) => {
    console.group('🔄 [useOnboarding] nextStep execution');
    console.log('Current Step:', currentStepId);
    console.log('Target Next Step:', currentStep.nextStepId);
    
    try {
      setIsLoading(true);
      setError(null);
      
      const hasDataToSave = data && Object.keys(data).length > 0;
      const tableName = currentStep.tableName;

      if (hasDataToSave && tableName) {
        console.log(`💾 Saving data to table [${tableName}]...`);
        await onboardingService.saveStepData(user.id, currentStep.id, data, tableName);
      } else {
        console.log('⏩ No data payload provided, advancing pointer only...');
        await onboardingService.saveStepData(user.id, currentStep.id, {}, 'profiles');
      }

      if (currentStep.nextStepId) {
        console.log('➡️ State update: Setting current step to', currentStep.nextStepId);
        setCurrentStepId(currentStep.nextStepId);
      } else {
        console.warn('⚠️ No nextStepId defined for current step:', currentStep.id);
      }
      
      console.groupEnd();
      return true;
    } catch (err) {
      console.error('❌ [useOnboarding] Error in nextStep:', err);
      setError(err.message || 'Error saving data');
      console.groupEnd();
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentStep, user, currentStepId]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevStep = ONBOARDING_STEPS[currentStepIndex - 1];
      console.log('⬅️ Going back to:', prevStep.id);
      setCurrentStepId(prevStep.id);
    }
  }, [currentStepIndex]);

  const completeOnboarding = useCallback(async () => {
    console.log('🎉 [useOnboarding] Completing onboarding process (state update)...');
    try {
      setIsLoading(true);
      // Removed duplicate DB call to onboardingService.completeOnboarding(user.id)
      // because DB update is now handled by closeOnboarding in useTour.js 
      // which allows for precise error handling and atomicity.
      
      setIsOnboardingCompleted(true);
      console.log('✅ Onboarding marked as complete in state.');
    } catch (err) {
      console.error('❌ [useOnboarding] Error completing:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    currentStep,
    currentStepIndex,
    totalSteps: ONBOARDING_STEPS.length,
    isFirstStep,
    isLastStep,
    isLoading,
    isMobile,
    error,
    isOnboardingCompleted,
    nextStep,
    previousStep,
    completeOnboarding
  };
};
