
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';

export const useDietCalories = (dietPlanId, initialBaseTdee, userId) => {
  const { toast } = useToast();
  const [overrides, setOverrides] = useState([]);
  const [baseTdee, setBaseTdee] = useState(initialBaseTdee || 0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch overrides and profile TDEE
  const fetchData = useCallback(async () => {
    // We need either dietPlanId OR userId to do anything useful
    if (!dietPlanId && !userId) return;
    
    setLoading(true);
    try {
      let targetUserId = userId;

      // 1. If we only have plan ID, fetch plan to get user_id and profile TDEE
      if (!targetUserId && dietPlanId) {
          const { data: planData, error: planError } = await supabase
            .from('diet_plans')
            .select(`
              user_id,
              profiles:user_id (
                tdee_kcal
              )
            `)
            .eq('id', dietPlanId)
            .single();

          if (planError) {
             console.error("Error fetching plan:", planError);
          } else if (planData) {
             targetUserId = planData.user_id;
             const profileTdee = planData?.profiles?.tdee_kcal || 0;
             setBaseTdee(profileTdee);
          }
      } else if (targetUserId) {
          // If we have userId, fetch profile TDEE directly
           const { data: profileData } = await supabase
            .from('profiles')
            .select('tdee_kcal')
            .eq('user_id', targetUserId)
            .single();
           if (profileData) setBaseTdee(profileData.tdee_kcal || 0);
      }

      // 2. Fetch Overrides (All history)
      // Query by user_id to see all history, regardless of plan linkage (User-Centric)
      if (targetUserId) {
          // Fix: Order by created_at, as effective_date column does not exist
          const { data: overridesData, error: overridesError } = await supabase
            .from('diet_plan_calorie_overrides')
            .select('*')
            .eq('user_id', targetUserId)
            .order('created_at', { ascending: false }); // Latest created is first

          if (overridesError) throw overridesError;
          setOverrides(overridesData || []);
      }

    } catch (err) {
      console.error('Error fetching diet calories data:', err);
    } finally {
      setLoading(false);
    }
  }, [dietPlanId, userId]);

  // Initial fetch
  useEffect(() => {
    if (dietPlanId || userId) {
      fetchData();
    } else {
        if (initialBaseTdee) {
             setBaseTdee(initialBaseTdee);
        }
    }
  }, [dietPlanId, userId, fetchData, initialBaseTdee]);

  // Determine active override
  // Logic: The most recently created override is the active one.
  const activeOverride = overrides.length > 0 ? overrides[0] : null;

  const effectiveTdee = activeOverride ? activeOverride.manual_calories : baseTdee;

  // Save (INSERT) an override
  const saveOverride = async (calories) => {
    // We need target user ID
    let targetUserId = userId;
    
    // Resolve user ID if missing
    if (!targetUserId && dietPlanId) {
        const { data } = await supabase.from('diet_plans').select('user_id').eq('id', dietPlanId).single();
        targetUserId = data?.user_id;
    }

    if (!targetUserId) return { error: 'No user ID found' };
    
    setActionLoading(true);
    try {
       // Insert NEW record (History preservation)
       // Fix: Only use columns that exist: user_id, diet_plan_id, manual_calories
       const { error: insertError } = await supabase
          .from('diet_plan_calorie_overrides')
          .insert({
            user_id: targetUserId,
            diet_plan_id: dietPlanId || null, // Optional
            manual_calories: calories
            // created_at is automatic
          });

      if (insertError) throw insertError;
      
      toast({ title: 'Éxito', description: 'Nueva asignación de calorías registrada.' });
      await fetchData(); 
      return { success: true };
    } catch (err) {
      console.error('Error saving override:', err);
      toast({ title: 'Error', description: 'No se pudo guardar el ajuste.', variant: 'destructive' });
      return { error: err.message };
    } finally {
      setActionLoading(false);
    }
  };

  // Delete an override
  const deleteOverride = async (overrideId) => {
    if (!overrideId) return { error: 'No override ID provided' };
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('diet_plan_calorie_overrides')
        .delete()
        .eq('id', overrideId);

      if (error) throw error;
      
      toast({ title: 'Éxito', description: 'Registro de calorías eliminado.' });
      await fetchData(); 
      return { success: true };
    } catch (err) {
      console.error('Error deleting override:', err);
      toast({ title: 'Error', description: 'No se pudo eliminar el ajuste.', variant: 'destructive' });
      return { error: err.message };
    } finally {
      setActionLoading(false);
    }
  };

  return {
    overrides, // Full History
    baseTdee,
    activeOverride, // Currently active record
    effectiveTdee,
    loading,
    actionLoading,
    fetchOverrides: fetchData,
    saveOverride,
    deleteOverride
  };
};
