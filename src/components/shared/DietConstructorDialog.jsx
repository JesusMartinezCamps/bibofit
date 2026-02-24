import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import DietConstructor from '@/components/plans/DietConstructor';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DietConstructorDialog = ({ open, onOpenChange, userId, dietPlanId, onPlanUpdate, isTemplate = false }) => {
    const [dietPlan, setDietPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (open && dietPlanId) {
            const fetchPlan = async () => {
                setLoading(true);
                const { data, error } = await supabase
                    .from('diet_plans')
                    .select('*')
                    .eq('id', dietPlanId)
                    .single();
                
                if (error) {
                    console.error("Error fetching diet plan for constructor:", error);
                    setDietPlan(null);
                } else {
                    setDietPlan(data);
                }
                setLoading(false);
            };
            fetchPlan();
        }
    }, [open, dietPlanId]);
    
    const handleOpenChange = (isOpen) => {
        onOpenChange(isOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="bg-[#1a1e23] border-gray-700 text-white max-w-6xl h-[90vh] flex flex-col p-0">
                <div className="flex-grow overflow-y-auto px-6 pb-6 pt-6 styled-scrollbar-green">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                           <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                        </div>
                    ) : dietPlan ? (
                        <DietConstructor
                            userId={userId}
                            dietPlan={dietPlan}
                            onPlanUpdate={onPlanUpdate}
                            isTemplate={isTemplate || dietPlan.is_template}
                        />
                    ) : (
                        <p className="text-center text-gray-400 py-10">No hay un plan de dieta activo para configurar.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DietConstructorDialog;