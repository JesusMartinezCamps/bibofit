import { supabase } from '@/lib/customSupabaseClient';

/**
 * Marks a guide block as seen for the given user.
 * Appends the blockId to the seen_guide_blocks array in profiles.
 */
export const markGuideBlockSeen = async (userId, blockId) => {
  if (!userId || !blockId) return { success: false };

  try {
    // Use array_append via RPC or raw update — we fetch current array first
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('seen_guide_blocks')
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    const current = profile?.seen_guide_blocks ?? [];
    if (current.includes(blockId)) return { success: true }; // already seen

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ seen_guide_blocks: [...current, blockId] })
      .eq('user_id', userId);

    if (updateError) throw updateError;
    return { success: true };
  } catch (error) {
    console.error('[updateSeenGuides] Error:', error);
    return { success: false, error };
  }
};

/**
 * Resets one or all guide blocks for a user (used from Help Center).
 * Pass blockId to reset a single block, or null to reset all.
 */
export const resetGuideBlocks = async (userId, blockId = null) => {
  if (!userId) return { success: false };

  try {
    let newValue;

    if (blockId) {
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('seen_guide_blocks')
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;
      const current = profile?.seen_guide_blocks ?? [];
      newValue = current.filter((id) => id !== blockId);
    } else {
      newValue = [];
    }

    const { error } = await supabase
      .from('profiles')
      .update({ seen_guide_blocks: newValue })
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[resetGuideBlocks] Error:', error);
    return { success: false, error };
  }
};

/**
 * Fetches the seen_guide_blocks array for a user.
 */
export const fetchSeenGuideBlocks = async (userId) => {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('seen_guide_blocks')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data?.seen_guide_blocks ?? [];
  } catch (error) {
    console.error('[fetchSeenGuideBlocks] Error:', error);
    return [];
  }
};
