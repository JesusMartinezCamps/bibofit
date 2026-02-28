import { supabase } from '@/lib/customSupabaseClient';

export const updateQuickStartGuideStatus = async (userId, hasSeen) => {
  if (!userId) return { success: false, error: 'User ID is required' };
  
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ has_seen_quick_guide: hasSeen })
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating quick start guide status:', error);
    return { success: false, error };
  }
};