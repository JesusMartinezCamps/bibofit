import React, { useState, useEffect } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Moon, Sun, X, Info, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OnboardingModal from './OnboardingModal';
import { useTheme } from '@/contexts/ThemeContext';
import { ONBOARDING_STEPS } from '@/lib/onboarding/onboardingConfig';
import { useAuth } from '@/hooks/useAuth';

// Existing Steps
import IntroStep from './steps/IntroStep';
import PhysicalDataStep from './steps/PhysicalDataStep';
import DietObjectiveStep from './steps/DietObjectiveStep';
import DietMealsStep from './steps/DietMealsStep';
import DietRestrictionsStep from './steps/DietRestrictionsStep';
import DietPreferencesStep from './steps/DietPreferencesStep';
import CompletionStep from './steps/CompletionStep';

// New Steps
import MealMacroDistributionStep from './steps/MealMacroDistributionStep';
import MealAdjustmentStep from './steps/MealAdjustmentStep';

// Pasos que se muestran en la barra de navegación rápida (sin intro ni completion)
const NAV_STEPS = ONBOARDING_STEPS.filter(
  s => s.id !== 'intro' && s.id !== 'completion'
);

// Etiquetas cortas para la nav bar
const STEP_SHORT_LABEL = {
  'physical-data':            'Físico',
  'diet_objective_history':   'Objetivo',
  'diet_meals_preferences':   'Comidas',
  'diet_restrictions':        'Restricciones',
  'diet_preferences':         'Gustos',
  'meal-macro-distribution':  'Macros',
  'meal-adjustment':          'Ajuste',
};

const OnboardingWizard = ({ isOpen: propIsOpen }) => {
  const { isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();
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
    jumpToStep,
    isRepeatingOnboarding
  } = useOnboarding();

  // En modo repetición el modal NO aparece automáticamente: el usuario lo abre con el botón ℹ️
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

  // Al cambiar de paso: en primera vez el modal se auto-muestra; en repetición empieza cerrado
  useEffect(() => {
    setIsModalDismissed(isRepeatingOnboarding);
  }, [currentStep?.id, isRepeatingOnboarding]);

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
  const hasModalContent = Boolean(currentStep.showModal && activeModalContent);
  const canJumpToMealAdjustment = hasCompletedOnboardingOnce
    && isRepeatingOnboarding
    && currentStep.id !== 'meal-adjustment'
    && currentStep.id !== 'completion';
  const isEdgeToEdgeMobileStep = currentStep.id === 'meal-macro-distribution' || currentStep.id === 'meal-adjustment';

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
      <div className="px-4 py-3 md:px-8 md:py-4 flex items-center justify-between border-b border-border shrink-0 relative bg-[#0f1115] z-10">
        {/* Izquierda: botón anterior (solo primer onboarding) */}
        {!isRepeatingOnboarding ? (
          !isFirstStep && !isLastStep ? (
            <Button variant="ghost" size="icon" onClick={previousStep} className="text-muted-foreground hover:text-muted-foreground hover:bg-muted">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          ) : (
            <div className="w-10" />
          )
        ) : (
          <div className="w-10" />
        )}

        {/* Centro: indicador de paso (solo primer onboarding) */}
        {!isRepeatingOnboarding && !isFirstStep && !isLastStep && (
          <span className="font-semibold text-sm md:text-base text-foreground">
            Paso {currentStepIndex} de {totalSteps - 2}
          </span>
        )}

        {/* Derecha: acciones */}
        <div className="flex justify-end gap-1">
          {/* Botón ℹ️ modal explicativo — visible en repetición cuando el paso tiene contenido */}
          {isRepeatingOnboarding && hasModalContent && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsModalDismissed(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Ver explicación de este paso"
              disabled={isLoading}
            >
              <Info className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            disabled={isLoading}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          {canJumpToMealAdjustment && !isRepeatingOnboarding && (
            <Button
              variant="ghost"
              size="icon"
              onClick={jumpToMealAdjustment}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
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
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Cerrar onboarding"
              disabled={isLoading}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Cerrar sesión"
            disabled={isLoading}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Barra de navegación por pasos (solo modo repetición) */}
      {isRepeatingOnboarding && !isFirstStep && !isLastStep && (
        <div className="shrink-0 border-b border-border bg-[#0f1115] px-2 py-2 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max px-2">
            {NAV_STEPS.map((step) => {
              const isActive = step.id === currentStep.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => jumpToStep(step.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  {STEP_SHORT_LABEL[step.id] ?? step.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de progreso (solo primer onboarding) */}
      {!isRepeatingOnboarding && !isFirstStep && !isLastStep && (
        <div className="h-1 bg-muted w-full overflow-hidden shrink-0">
          <div
            className="h-full bg-green-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col min-h-0">
        <div className={`flex-1 ${isEdgeToEdgeMobileStep ? 'px-0' : 'pl-6 pr-0'} py-8 md:px-8 md:py-8 flex flex-col h-full overflow-hidden`}>
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
                        <div className="mb-6 md:mb-8 shrink-0 text-center md:text-left pr-6 md:pr-0">
                            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-white">{currentStep.title}</h2>
                            <p className="text-muted-foreground text-sm md:text-base">{currentStep.description}</p>
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
