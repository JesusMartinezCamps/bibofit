import { supabase } from '@/lib/supabaseClient';

export const saveAssignmentProgress = async (userId, currentStep, tourShown, tourAccepted, planData) => {
  if (!userId) return;

  const { error } = await supabase
    .from('assignment_progress')
    .upsert({
      user_id: userId,
      current_step: currentStep,
      tour_shown: tourShown,
      tour_accepted: tourAccepted,
      plan_data: planData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error saving assignment progress:', error);
  }
};

export const loadAssignmentProgress = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('assignment_progress')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is no rows returned
    console.error('Error loading assignment progress:', error);
    return null;
  }

  return data;
};

export const deleteAssignmentProgress = async (userId) => {
  if (!userId) return;

  const { error } = await supabase
    .from('assignment_progress')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting assignment progress:', error);
  }
};