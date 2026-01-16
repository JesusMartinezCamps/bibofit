
import React from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import IntroStep from './steps/IntroStep';
import PersonalDataStep from './steps/PersonalDataStep';
import PhysicalDataStep from './steps/PhysicalDataStep';
import DietObjectiveStep from './steps/DietObjectiveStep';
import DietMealsStep from './steps/DietMealsStep';
import DietRestrictionsStep from './steps/DietRestrictionsStep';
import DietPreferencesStep from './steps/DietPreferencesStep';
import CompletionStep from './steps/CompletionStep';

const OnboardingWizard = () => {
  const navigate = useNavigate();
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
    isOnboardingCompleted
  } = useOnboarding();

  const handleNext = async (data) => {
    console.group('🚀 [OnboardingWizard] handleNext Triggered');
    console.log('Step ID:', currentStep.id);
    console.log('Payload:', data);
    
    try {
      if (currentStep.id === 'completion') {
        console.log('Action: Completing Onboarding');
        await completeOnboarding();
      } else {
        console.log('Action: Advancing to Next Step');
        const success = await nextStep(data);
        console.log('Advance Result:', success ? 'SUCCESS' : 'FAILURE');
      }
    } catch (error) {
      console.error('❌ [OnboardingWizard] Critical Error in handleNext:', error);
    } finally {
      console.groupEnd();
    }
  };

  // Ensure mapping matches IDs in config
  const StepComponent = {
    'intro': IntroStep,
    'personal-data': PersonalDataStep,
    'physical-data': PhysicalDataStep,
    'diet_objective_history': DietObjectiveStep,
    'diet_meals_preferences': DietMealsStep, 
    'diet_meals': DietMealsStep, // Fallback
    'diet_restrictions': DietRestrictionsStep,
    'diet_preferences': DietPreferencesStep,
    'completion': CompletionStep
  }[currentStep.id] || IntroStep;

  // Calculate progress percentage
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f1115] text-white flex flex-col h-[100dvh]">
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-gray-800 shrink-0 relative">
          {/* Back Button */}
          {!isFirstStep && !isLastStep ? (
              <Button variant="ghost" size="icon" onClick={previousStep} className="text-gray-400 hover:text-gray-400 hover:bg-gray-800">
                  <ChevronLeft className="h-6 w-6" />
              </Button>
          ) : (
              <div className="w-10" /> 
          )}

          {/* Step Indicator */}
          {!isFirstStep && !isLastStep && (
              <span className="font-semibold text-sm text-gray-200">
                  Paso {currentStepIndex} de {totalSteps - 2}
              </span>
          )}

          {/* Right side: Close button if completed, otherwise spacer */}
          {isOnboardingCompleted ? (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/home')} 
                className="text-gray-400 hover:text-white hover:bg-gray-800"
              >
                  <X className="h-6 w-6" />
              </Button>
          ) : (
              <div className="w-10" />
          )}
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
      <div className="flex-1 overflow-hidden relative w-full max-w-md mx-auto flex flex-col">
        <div className="flex-1 p-6 flex flex-col h-full overflow-hidden">
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
                        <div className="mb-6 shrink-0">
                            <h2 className="text-2xl font-bold mb-2 text-white">{currentStep.title}</h2>
                            <p className="text-gray-400 text-sm">{currentStep.description}</p>
                        </div>
                    )}

                    <div className="flex-1 overflow-hidden flex flex-col">
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
