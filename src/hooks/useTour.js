
// DEPRECATED: Tour functionality has been replaced by the OnboardingWizard flow.
export const useTour = () => ({
  isOpen: false,
  currentStep: 0,
  totalSteps: 0,
  nextStep: () => {},
  previousStep: () => {},
  closeTour: () => {},
  startTour: () => {}
});
