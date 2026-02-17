import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const useChangeRequests = (userId, planItems) => {
    const [changeRequests, setChangeRequests] = useState([]);

    const fetchChangeRequests = useCallback(async () => {
        if (!userId || !planItems || planItems.length === 0) {
            setChangeRequests([]);
            return;
        }

        const planRecipeIds = planItems.filter(item => item.type === 'recipe').map(item => item.id);
        if (planRecipeIds.length === 0) {
            setChangeRequests([]);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('diet_change_requests')
                .select('*')
                .in('diet_plan_recipe_id', planRecipeIds)
                .order('requested_at', { ascending: false });

            if (error) {
                throw error;
            }

            const latestRequests = data.reduce((acc, req) => {
                const existingReq = acc[req.diet_plan_recipe_id];
                if (!existingReq || new Date(req.requested_at) > new Date(existingReq.requested_at)) {
                    acc[req.diet_plan_recipe_id] = req;
                }
                return acc;
            }, {});
            
            setChangeRequests(Object.values(latestRequests));
        } catch (error) {
            console.error("Error fetching change requests:", error);
            setChangeRequests([]);
        }
    }, [userId, planItems]);

    useEffect(() => {
        fetchChangeRequests();
    }, [fetchChangeRequests]);

    return { changeRequests, fetchChangeRequests };
};