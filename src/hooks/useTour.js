import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { TOUR_STEPS } from '@/lib/tour/tourConfig';
import { useToast } from '@/components/ui/use-toast';

export const useTour = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tourState, setTourState] = useState({
    tour_step_id: null,
    tour_started_at: null,
    tour_completed_at: null,
    loading: true
  });

  const fetchTourState = useCallback(async () => {
    if (!user) {
      setTourState(prev => ({ ...prev, loading: false }));
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('tour_step_id, tour_started_at, tour_completed_at')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      setTourState({
        ...data,
        loading: false
      });
    } catch (err) {
      console.error('❌ [useTour] Error fetching tour state:', err);
      setTourState(prev => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    fetchTourState();
  }, [fetchTourState]);

  const updateProfileTour = async (updates) => {
    if (!user) {
      console.error('❌ [useTour] No user found for update');
      return;
    }

    try {
      console.log('💾 [useTour] Updating profile with:', updates);
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('❌ [useTour] DB Update Error:', error);
        throw error;
      }
      
      console.log('✅ [useTour] DB Update Success');
      setTourState(prev => ({ ...prev, ...updates }));
      return true;
    } catch (err) {
      console.error('❌ [useTour] Update failed:', err);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del tour.",
        variant: "destructive"
      });
      throw err;
    }
  };

  const startTourFromOnboarding = async () => {
    console.group('🚀 [useTour] startTourFromOnboarding');
    try {
      if (!user) throw new Error("Usuario no autenticado");

      const updates = {
        tour_started_at: new Date().toISOString(),
        tour_step_id: 'diet-templates',
        tour_completed_at: null 
      };

      await updateProfileTour(updates);
      console.log('✅ Tour started successfully');
    } catch (error) {
      console.error('❌ Failed to start tour:', error);
      throw error;
    } finally {
      console.groupEnd();
    }
  };

  const nextTourStep = async (stepId) => {
    console.log('➡️ [useTour] Advancing to step:', stepId);
    if (!TOUR_STEPS[stepId]) {
      console.warn(`⚠️ [useTour] Invalid tour step: ${stepId}`);
      return;
    }
    await updateProfileTour({ tour_step_id: stepId });
  };

  const completeTour = async () => {
    console.log('🎉 [useTour] Completing tour');
    const updates = {
      tour_completed_at: new Date().toISOString(),
      tour_step_id: 'tour-completed'
    };
    await updateProfileTour(updates);
  };

  const closeTour = async () => {
    console.log('🛑 [useTour] Closing tour context');
    const updates = {
      tour_completed_at: new Date().toISOString(),
      tour_step_id: null
    };
    await updateProfileTour(updates);
  };

  /**
   * Completes the onboarding process by setting the timestamp.
   * Only updates if it hasn't been set previously (is NULL).
   * Returns an error object if no rows were updated (meaning it was already completed).
   */
  const closeOnboarding = async () => {
    if (!user) return { success: false, error: 'No authenticated user' };

    try {
      console.log('🏁 [useTour] Closing onboarding...');
      
      // Update DB and return selected rows to check if update actually happened
      const { data, error } = await supabase
        .from('profiles')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('onboarding_completed_at', null)
        .select();

      if (error) throw error;

      // If data is empty, it means condition .is('onboarding_completed_at', null) failed,
      // so it was already completed.
      if (!data || data.length === 0) {
        console.warn('⚠️ [useTour] Onboarding already completed or user not found');
        return { 
          success: false, 
          error: { code: 'ALREADY_COMPLETED', message: 'Onboarding already completed' } 
        };
      }

      console.log('✅ [useTour] Onboarding closed successfully');
      return { success: true };
    } catch (err) {
      console.error('❌ [useTour] Failed to close onboarding:', err);
      return { success: false, error: err };
    }
  };

  const isTourActive = useCallback(() => {
    const active = !!tourState.tour_started_at && !tourState.tour_completed_at;
    return active;
  }, [tourState]);

  const getCurrentTourStep = useCallback(() => {
    return tourState.tour_step_id;
  }, [tourState]);

  return {
    ...tourState,
    startTourFromOnboarding,
    initTour: startTourFromOnboarding,
    nextTourStep,
    completeTour,
    closeTour,
    closeOnboarding,
    isTourActive,
    getCurrentTourStep,
    refreshTour: fetchTourState
  };
};
