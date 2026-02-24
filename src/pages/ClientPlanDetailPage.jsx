import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import AdminDietPlanDetailPage from '@/pages/admin/AdminDietPlanDetailPage';

const ClientPlanDetailPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [activePlanId, setActivePlanId] = useState(null);
    const [hasCoach, setHasCoach] = useState(false);

    useEffect(() => {
        const checkUserStatus = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // 1. Check active plan
                const { data: planData, error: planError } = await supabase
                    .from('diet_plans')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .maybeSingle();

                if (planError && planError.code !== 'PGRST116') { // Ignore "no rows" error
                    throw planError;
                }

                // 2. Check coach status
                const { data: assignments, error: coachError } = await supabase
                    .from('coach_clients')
                    .select('coach_id')
                    .eq('client_id', user.id);

                if (coachError) throw coachError;

                setActivePlanId(planData?.id || null);
                setHasCoach(assignments && assignments.length > 0);

            } catch (err) {
                console.error("Error checking user status:", err);
                toast({ title: 'Error', description: 'No se pudo verificar tu estado.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };

        checkUserStatus();
    }, [user, toast]);

    if (loading) {
        return <div className="flex justify-center items-center h-screen bg-[#1a1e23]"><Loader2 className="w-10 h-10 animate-spin text-green-500" /></div>;
    }

    // CASE 1: Active Diet Exists
    if (activePlanId) {
        return (
            <>
                <Helmet>
                    <title>Mi Plan Actual - Gsus Martz</title>
                </Helmet>
                <div className="p-4 lg:p-6 max-w-[1600px] mx-auto min-h-screen">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                            Mi Plan Actual
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {hasCoach 
                                ? "Este plan está gestionado por tu entrenador. Solo puedes ver los detalles." 
                                : "Este plan es gestionado por ti. Puedes editar macros y recetas."}
                        </p>
                    </div>

                    <AdminDietPlanDetailPage 
                        planIdOverride={activePlanId}
                        mode="user"
                        readOnlyProperties={true}
                        hideUserAssignmentPanel={true}
                        canEditMacros={!hasCoach}
                        canEditRecipes={!hasCoach}
                    />
                </div>
            </>
        );
    }

    // CASE 2: No Active Diet
    return (
        <div className="p-8 max-w-4xl mx-auto min-h-[80vh] flex flex-col items-center justify-center text-center">
            <Helmet>
                <title>Sin Plan Activo - Gsus Martz</title>
            </Helmet>
            
            <div className="bg-slate-900/50 border border-gray-800 rounded-2xl p-10 shadow-2xl max-w-lg w-full">
                <div className="mb-6 flex justify-center">
                    <div className="bg-gray-800 p-4 rounded-full">
                         <span className="text-4xl">🥗</span>
                    </div>
                </div>
                
                <h1 className="text-2xl font-bold text-white mb-4">No tienes una dieta activa</h1>
                
                {hasCoach ? (
                    // Case 2.1: Has Coach
                    <div className="space-y-4">
                        <p className="text-gray-400 text-lg">
                            Todavía no tienes una dieta asignada.
                        </p>
                        <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg text-blue-200 text-sm">
                            Ponte en contacto con tu coach para que prepare tu plan nutricional.
                        </div>
                    </div>
                ) : (
                    // Case 2.2: No Coach
                    <div className="space-y-6">
                        <p className="text-gray-400 text-lg">
                            Parece que aún no has seleccionado un plan nutricional.
                        </p>
                        <Button 
                            onClick={() => navigate('/diet-templates')} 
                            className="bg-green-600 hover:bg-green-700 text-white w-full py-6 text-lg shadow-lg shadow-green-900/20 transition-all hover:scale-[1.02]"
                        >
                            Explorar plantillas de dieta <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                        <p className="text-xs text-gray-500">
                            Elige una plantilla base y personalízala según tus necesidades.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientPlanDetailPage;