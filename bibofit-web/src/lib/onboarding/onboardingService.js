
import { supabase } from '@/lib/customSupabaseClient';
import { getStepConfig } from './onboardingConfig';
import { calculateAndSaveMetabolism } from '@/lib/metabolismCalculator';
import { format } from 'date-fns';

const fetchDefaultDietTemplate = async () => {
  const { data, error } = await supabase
    .from('diet_plans')
    .select('id, name, protein_pct, carbs_pct, fat_pct')
    .eq('name', 'Mi última dieta')
    .eq('is_template', true)
    .limit(1);

  if (error) {
    console.error("Error fetching default template 'Mi última dieta':", error);
    return null;
  }

  return data?.[0] || null;
};

const syncTodaysWeightLog = async (userId, weightKg) => {
  if (!userId || !Number.isFinite(weightKg) || weightKg <= 0) return;

  const today = format(new Date(), 'yyyy-MM-dd');
  const description = 'Peso inicial registrado durante onboarding.';

  const { data: existingLog, error: fetchError } = await supabase
    .from('weight_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('logged_on', today)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existingLog?.id) {
    const { error: updateError } = await supabase
      .from('weight_logs')
      .update({ weight_kg: weightKg, description })
      .eq('id', existingLog.id);

    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase
    .from('weight_logs')
    .insert({
      user_id: userId,
      logged_on: today,
      weight_kg: weightKg,
      description
    });

  if (insertError) throw insertError;
};

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

  async saveStepData(userId, stepId, data) {
    console.group(`🛠️ [onboardingService] saveStepData (${stepId})`);
    console.log('User ID:', userId);
    console.log('Data payload:', data);
    
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
    }

    // 2. Handle specific step data saving logic if data is provided
    if (!data || Object.keys(data).length === 0) {
        console.log('ℹ️ No data payload to save.');
    } else {
        try {
            if (stepId === 'physical-data') {
              console.log('💾 Saving to profiles table...');
              const { error } = await supabase
                .from('profiles')
                .update(data)
                .eq('user_id', userId);
              if (error) throw error;

              console.log('⚖️ Syncing weight log for today...');
              await syncTodaysWeightLog(userId, Number(data.current_weight_kg));

              console.log('🔄 Triggering metabolism calculation...');
              await calculateAndSaveMetabolism(userId);
            } 
            else if (stepId === 'diet_objective_history') {
               console.log('💾 Saving to diet_preferences (upsert)...', data);
               const { error } = await supabase
                 .from('diet_preferences')
                 .upsert({ user_id: userId, ...data }, { onConflict: 'user_id' });
               if (error) throw error;
            }
            else if (stepId === 'meal-macro-distribution') {
                console.log('💾 Saving macro distribution...');
                
                // CRITICAL FIX: Removed profiles.tdee_kcal update. 
                // We only use calorie overrides for manual adjustments.
                
                // 1. Insert overrides if present
                if (data.overrides && data.overrides.length > 0) {
                    const overridesToInsert = data.overrides.map(o => ({
                        user_id: userId,
                        manual_calories: o.manual_calories
                    }));
                    
                    const { error: overridesError } = await supabase
                        .from('diet_plan_calorie_overrides')
                        .insert(overridesToInsert);
                    
                    if (overridesError) console.error("Error saving overrides:", overridesError);
                }
                
                // 2. Save macros to assignment_progress
                if (data.macroDistribution) {
                    const { data: currentProgress } = await supabase
                        .from('assignment_progress')
                        .select('plan_data')
                        .eq('user_id', userId)
                        .maybeSingle();
                    
                    const existingPlanData = currentProgress?.plan_data || {};
                    const fallbackTemplate = existingPlanData?.template
                      || existingPlanData?.selectedTemplate
                      || await fetchDefaultDietTemplate();
                    const newPlanData = {
                        ...existingPlanData,
                        dailyCalories: data.dailyCalories ?? existingPlanData.dailyCalories,
                        macroDistribution: data.macroDistribution,
                        // Backward compatibility with older reads expecting this key.
                        macros: data.macroDistribution,
                        ...(existingPlanData?.template ? {} : { template: fallbackTemplate }),
                        ...(existingPlanData?.selectedTemplate ? {} : { selectedTemplate: fallbackTemplate })
                    };

                    const { error: progressError } = await supabase
                        .from('assignment_progress')
                        .upsert({ 
                            user_id: userId, 
                            plan_data: newPlanData,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'user_id' });
                    
                    if (progressError) console.error("Error saving macros to assignment_progress:", progressError);
                }
            }
            
            console.log('✅ Data saved successfully');
        } catch (error) {
            console.error('❌ Database Error:', error);
            throw error;
        }
    }
    
    console.groupEnd();
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
     // Validate admin permissions before resetting onboarding
     const { data: roleData } = await supabase
       .from('user_roles')
       .select('roles(role)')
       .eq('user_id', userId)
       .single();

     if (roleData?.roles?.role !== 'admin') {
       console.log(`[SECURITY AUDIT] Unauthorized onboarding reset attempt by User ID: ${userId} at ${new Date().toISOString()}`);
       throw new Error("Solo administradores pueden reiniciar el onboarding");
     }

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
