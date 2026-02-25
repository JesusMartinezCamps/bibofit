import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { updateQuickStartGuideStatus } from '@/lib/updateQuickStartGuideStatus';

const QuickStartGuideContext = createContext();

export const QuickStartGuideProvider = ({ children }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeen, setHasSeen] = useState(true); // Default true to prevent flash

  useEffect(() => {
    const checkStatus = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('has_seen_quick_guide, onboarding_completed_at')
          .eq('user_id', user.id)
          .single();

        if (!error && data) {
          setHasSeen(data.has_seen_quick_guide);
          // If onboarding is completed but guide not seen, show it automatically
          if (data.onboarding_completed_at && !data.has_seen_quick_guide) {
            setIsOpen(true);
          }
        }
      }
    };
    checkStatus();
  }, [user]);

  const openGuide = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const closeGuide = async () => {
    setIsOpen(false);
  };

  const completeGuide = async () => {
    setIsOpen(false);
    setHasSeen(true);
    if (user?.id) {
      await updateQuickStartGuideStatus(user.id, true);
    }
  };

  const nextStep = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  return (
    <QuickStartGuideContext.Provider
      value={{
        isOpen,
        currentStep,
        hasSeen,
        openGuide,
        closeGuide,
        completeGuide,
        nextStep,
        prevStep,
      }}
    >
      {children}
    </QuickStartGuideContext.Provider>
  );
};

export const useQuickStartGuide = () => useContext(QuickStartGuideContext);