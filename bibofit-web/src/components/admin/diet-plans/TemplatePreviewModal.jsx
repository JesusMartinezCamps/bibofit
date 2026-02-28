import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import PlanView from '@/components/admin/diet-plans/PlanView';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const TemplatePreviewModal = ({ 
    templateId, 
    isOpen, 
    onClose, 
    userDayMeals, 
    allowManagement,
    onAssign
}) => {
    const [template, setTemplate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [previewUserDayMeals, setPreviewUserDayMeals] = useState([]);

    useEffect(() => {
        let isMounted = true;
        const fetchTemplateData = async () => {
            if (!templateId || !isOpen) return;
            
            setLoading(true);
            setTemplate(null);
            
            try {
                // Fetch template details
                const { data: templateData, error } = await supabase
                    .from('diet_plans')
                    .select(`
                        *,
                        sensitivities:diet_plan_sensitivities(sensitivities(id, name)),
                        medical_conditions:diet_plan_medical_conditions(medical_conditions(id, name))
                    `)
                    .eq('id', templateId)
                    .single();

                if (error) {
                    console.error("Error fetching template details:", error);
                    throw error;
                }

                if (isMounted) {
                    setTemplate(templateData);

                    // Prepare day meals structure for PlanView
                    if (userDayMeals && userDayMeals.length > 0) {
                        // Filter: Only show meals that the user has configured
                        setPreviewUserDayMeals(userDayMeals);
                    } else {
                        // Admin view or no user config: Show ALL meals defined in the system
                        // We need to fetch all day_meals to show the structure
                        const { data: allDayMeals, error: mealsError } = await supabase
                            .from('day_meals')
                            .select('id, name, display_order')
                            .order('display_order');
                        
                        if (mealsError) {
                             console.error("Error fetching day meals:", mealsError);
                        } else if (allDayMeals) {
                            // Map to structure expected by PlanView: { day_meal: { ... } }
                            const mappedMeals = allDayMeals.map(dm => ({
                                day_meal_id: dm.id,
                                day_meal: dm
                            }));
                            setPreviewUserDayMeals(mappedMeals);
                        }
                    }
                }

            } catch (err) {
                console.error("Error loading template preview:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchTemplateData();
        return () => { isMounted = false; };
    }, [templateId, isOpen, userDayMeals]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col bg-slate-950 border-slate-800 text-white p-0 overflow-hidden">
                <DialogHeader className="p-6 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex justify-between items-center pr-8">
                        <div>
                            <DialogTitle className="text-2xl font-bold">{template?.name || 'Vista Previa'}</DialogTitle>
                            <DialogDescription className="text-gray-400">
                                {loading ? 'Cargando...' : 'Vista previa del contenido del plan nutricional'}
                            </DialogDescription>
                        </div>
                        {allowManagement && (
                            <Link to={`/admin-panel/plan-detail/${templateId}`}>
                                <Button variant="outline" size="sm" className="border-blue-700 bg-blue-700/20 text-blue-400 hover:text-blue-200 hover:bg-blue-900/20">
                                    Gestionar Plantilla
                                </Button>
                            </Link>
                        )}
                         {!allowManagement && onAssign && (
                            <Button 
                                onClick={onAssign} 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-500 text-white"
                            >
                                Elegir esta dieta
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-grow overflow-y-auto styled-scrollbar">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="w-12 h-12 animate-spin text-green-500" />
                        </div>
                    ) : template ? (
                        <PlanView 
                            plan={template}
                            userDayMeals={previewUserDayMeals}
                            readOnly={true}
                            isTemplate={true}
                            onUpdate={() => {}}
                        />
                    ) : (
                        <div className="text-center text-gray-500 mt-10">No se pudo cargar la plantilla.</div>
                    )}
                </div>
                
                <div className="p-2 border-t border-slate-800 bg-slate-900 flex justify-end">
                    <Button variant="ghost" onClick={onClose}>Cerrar Vista Previa</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default TemplatePreviewModal;