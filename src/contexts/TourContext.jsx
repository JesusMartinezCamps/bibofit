
// DEPRECATED: Tour functionality has been replaced by the OnboardingWizard flow.
import React, { createContext } from 'react';

export const TourContext = createContext();

export const TourProvider = ({ children }) => {
  return <TourContext.Provider value={{}}>{children}</TourContext.Provider>;
};

export const useTour = () => ({
  isOpen: false,
  currentStep: 0,
  totalSteps: 0,
  nextStep: () => {},
  previousStep: () => {},
  closeTour: () => {},
  startTour: () => {}
});
