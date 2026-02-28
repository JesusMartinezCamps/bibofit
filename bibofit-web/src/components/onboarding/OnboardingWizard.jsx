import React, { useState, useEffect } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OnboardingModal from './OnboardingModal';

// Existing Steps
import IntroStep from './steps/IntroStep';
import PersonalDataStep from './steps/PersonalDataStep';
import PhysicalDataStep from './steps/PhysicalDataStep';
import DietObjectiveStep from './steps/DietObjectiveStep';
import DietMealsStep from './steps/DietMealsStep';
import DietRestrictionsStep from './steps/DietRestrictionsStep';
import DietPreferencesStep from './steps/DietPreferencesStep';
import CompletionStep from './steps/CompletionStep';

// New Steps
import MealMacroDistributionStep from './steps/MealMacroDistributionStep';
import MealAdjustmentStep from './steps/MealAdjustmentStep';

const OnboardingWizard = ({ isOpen: propIsOpen }) => {
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    previousStep,
    completeOnboarding,
    isLoading,
    isFirstStep,
    isLastStep,
    isOpen: contextIsOpen,
    hasCompletedOnboardingOnce,
    cancelOnboarding,
    jumpToMealAdjustment,
    isRepeatingOnboarding
  } = useOnboarding();

  // Local state to track if the modal for the current step has been dismissed
  const [isModalDismissed, setIsModalDismissed] = useState(false);

  // Determine effective open state: Prop overrides context if provided
  const effectiveIsOpen = propIsOpen !== undefined ? propIsOpen : contextIsOpen;

  // Scroll locking mechanism
  useEffect(() => {
    if (effectiveIsOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [effectiveIsOpen]);

  // Reset modal state when step changes
  useEffect(() => {
    setIsModalDismissed(false);
  }, [currentStep?.id]);

  if (!effectiveIsOpen) {
    return null;
  }

  // Safety check: if currentStep is undefined, return null to prevent crashes
  if (!currentStep) {
    console.error("OnboardingWizard: currentStep is undefined");
    return null;
  }

  const handleNext = async (data) => {
    try {
      console.log(`➡️ [OnboardingWizard] handleNext triggered for step: ${currentStep.id}`);
      if (currentStep.id === 'completion') {
        console.log("🏁 [OnboardingWizard] Completing onboarding...");
        await completeOnboarding(); 
      } else {
        await nextStep(data);
      }
    } catch (error) {
      console.error('❌ [OnboardingWizard] Error in handleNext:', error);
    }
  };

  const dismissModal = () => {
    setIsModalDismissed(true);
  };

  const StepComponent = {
    'intro': IntroStep,
    'personal-data': PersonalDataStep,
    'physical-data': PhysicalDataStep,
    'diet_objective_history': DietObjectiveStep,
    'diet_meals_preferences': DietMealsStep, 
    'diet_meals': DietMealsStep,
    'diet_restrictions': DietRestrictionsStep,
    'diet_preferences': DietPreferencesStep,
    'meal-macro-distribution': MealMacroDistributionStep,
    'meal-adjustment': MealAdjustmentStep,
    'completion': CompletionStep
  }[currentStep.id] || IntroStep;

  const progress = ((currentStepIndex + 1) / totalSteps) * 100;
  
  // Access modal content directly from the centralized config
  const activeModalContent = currentStep.modalContent;
  const shouldShowModal = Boolean(currentStep.showModal && activeModalContent && !isModalDismissed);
  const canJumpToMealAdjustment = hasCompletedOnboardingOnce
    && isRepeatingOnboarding
    && currentStep.id !== 'meal-adjustment'
    && currentStep.id !== 'completion';

  // If it's the completion step, just render it directly (it has its own full-screen layout)
  if (currentStep.id === 'completion') {
      return <StepComponent onNext={handleNext} isLoading={isLoading} />;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f1115] text-white flex flex-col h-[100dvh] overflow-hidden">
      
      {/* Onboarding Modal Overlay */}
      <AnimatePresence>
        {shouldShowModal && activeModalContent && (
          <OnboardingModal
            title={activeModalContent.title || ''}
            description={activeModalContent.description || ''}
            videoUrl={activeModalContent.videoUrl}
            tips={activeModalContent.tips}
            onNext={dismissModal}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-6 py-4 md:px-8 md:py-6 flex items-center justify-between border-b border-gray-800 shrink-0 relative bg-[#0f1115] z-10">
          {!isFirstStep && !isLastStep ? (
              <Button variant="ghost" size="icon" onClick={previousStep} className="text-gray-400 hover:text-gray-400 hover:bg-gray-800">
                  <ChevronLeft className="h-6 w-6" />
              </Button>
          ) : (
              <div className="w-10" /> 
          )}

          {!isFirstStep && !isLastStep && (
              <span className="font-semibold text-sm md:text-base text-gray-200">
                  Paso {currentStepIndex} de {totalSteps - 2}
              </span>
          )}

           <div className="min-w-[5.5rem] flex justify-end gap-1">
            {canJumpToMealAdjustment && (
              <Button
                variant="ghost"
                size="icon"
                onClick={jumpToMealAdjustment}
                className="text-gray-400 hover:text-white hover:bg-gray-800"
                aria-label="Ir al ajuste final"
                disabled={isLoading}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
            {hasCompletedOnboardingOnce && (
              <Button
                variant="ghost"
                size="icon"
                onClick={cancelOnboarding}
                className="text-gray-400 hover:text-white hover:bg-gray-800"
                aria-label="Cerrar onboarding"
                disabled={isLoading}
              >
                <X className="h-5 w-5" />
              </Button>
            )}
           </div>
      </div>

      {/* Progress Bar */}
      {!isFirstStep && !isLastStep && (
         <div className="h-1 bg-gray-800 w-full overflow-hidden shrink-0">
            <div 
              className="h-full bg-green-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
         </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col min-h-0">
        <div className="flex-1 px-6 py-8 md:px-8 md:py-8 flex flex-col h-full overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep.id}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="flex flex-col h-full"
                >
                    {currentStep.type === 'form' && (
                        <div className="mb-6 md:mb-8 shrink-0 text-center md:text-left">
                            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-white">{currentStep.title}</h2>
                            <p className="text-gray-400 text-sm md:text-base">{currentStep.description}</p>
                        </div>
                    )}

                    <div className="flex-1 flex flex-col min-h-0">
                        <StepComponent 
                            onNext={handleNext} 
                            isLoading={isLoading} 
                        />
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
