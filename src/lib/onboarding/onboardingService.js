
import { supabase } from '@/lib/customSupabaseClient';
import { getStepConfig } from './onboardingConfig';

export const onboardingService = {
  async getOnboardingStatus(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_step_id, onboarding_completed_at, onboarding_version')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[onboardingService] Error fetching status:', error);
      return null;
    }
    return data;
  },

  async saveStepData(userId, stepId, data, tableName = 'profiles') {
    console.group(`🛠️ [onboardingService] saveStepData (${stepId})`);
    console.log('User ID:', userId);
    console.log('Table:', tableName);
    console.log('Data Keys:', Object.keys(data));
    
    // 1. Determine the next step to update the progress pointer
    const currentStepConfig = getStepConfig(stepId);
    const nextStepId = currentStepConfig?.nextStepId;

    if (nextStepId) {
      console.log(`👉 Updating profile pointer to: ${nextStepId}`);
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_step_id: nextStepId })
        .eq('user_id', userId);

      if (profileError) {
        console.error('❌ Error updating profile step pointer:', profileError);
        console.groupEnd();
        throw profileError;
      }
    } else {
        console.warn('⚠️ No nextStepId found in config for', stepId);
    }

    // 2. Handle specific step data saving logic if data is provided
    if (!data || Object.keys(data).length === 0) {
        console.log('ℹ️ No data payload to save. Finished.');
        console.groupEnd();
        return; 
    }

    try {
        if (stepId === 'personal-data' || stepId === 'physical-data') {
          console.log('💾 Saving to profiles table...');
          const { error } = await supabase
            .from('profiles')
            .update(data)
            .eq('user_id', userId);
          if (error) throw error;
        } 
        else if (stepId === 'diet_objective_history') {
           console.log('💾 Saving to diet_preferences (upsert)...', data);
           // Data payload should already have diet_goal_id from the component
           const { error } = await supabase
             .from('diet_preferences')
             .upsert({ user_id: userId, ...data }, { onConflict: 'user_id' });
           if (error) throw error;
        }
        
        console.log('✅ Data saved successfully');
    } catch (error) {
        console.error('❌ Database Error:', error);
        throw error;
    } finally {
        console.groupEnd();
    }
  },

  async updateOnboardingCompletedAt(userId) {
    console.log('[onboardingService] Updating onboarding_completed_at timestamp');
    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  },

  async completeOnboarding(userId) {
    console.log('[onboardingService] Completing onboarding...');
    // We update the timestamp, version and step ID.
    // Explicitly using the logic of updateOnboardingCompletedAt as part of this operation
    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: '1.0',
        onboarding_step_id: 'completion'
      })
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  },
  
  async resetOnboarding(userId) {
     const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_completed_at: null,
        onboarding_step_id: 'intro'
      })
      .eq('user_id', userId);
      
     if (error) throw error;
     return true;
  }
};
