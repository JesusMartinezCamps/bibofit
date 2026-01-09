
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const UserDietTemplatesPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkCoachStatus = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // Check if the user has a coach assigned
                const { data: assignments, error } = await supabase
                    .from('coach_clients')
                    .select('coach_id')
                    .eq('client_id', user.id);

                if (error) throw error;

                const hasCoach = assignments && assignments.length > 0;

                // Routing logic based on coach status
                if (hasCoach) {
                    navigate('/my-plan', { replace: true });
                } else {
                    navigate('/diet-templates', { replace: true });
                }
            } catch (error) {
                console.error("Error determining user path:", error);
                navigate('/my-plan', { replace: true }); // Fallback
            } finally {
                setLoading(false);
            }
        };

        checkCoachStatus();
    }, [user, navigate]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-[#1a1e23]">
                <Loader2 className="w-10 h-10 animate-spin text-green-500" />
            </div>
        );
    }

    return null; // This page strictly redirects
};

export default UserDietTemplatesPage;
