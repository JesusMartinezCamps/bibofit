import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Copy, UserCheck, ShieldAlert, HeartPulse, Tag, Edit2, Globe, Building2, ArrowUpCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import RestrictionsManager from '@/components/admin/diet-plans/RestrictionsManager';
import ClassificationBadge from '@/components/admin/diet-plans/ClassificationBadge';
import ClassificationManager from '@/components/admin/diet-plans/ClassificationManager';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const ClassificationDialog = ({ template, open, onOpenChange, onUpdate }) => {
    const { toast } = useToast();
    const [values, setValues] = useState({
        objective: template.classification_objective || [],
        lifestyle: template.classification_lifestyle || [],
        nutrition_style: template.classification_nutrition_style || []
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (axis, newValues) => {
        setValues(prev => ({ ...prev, [axis]: newValues }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase.from('diet_plans').update({
                classification_objective: values.objective,
                classification_lifestyle: values.lifestyle,
                classification_nutrition_style: values.nutrition_style
            }).eq('id', template.id);

            if (error) throw error;
            toast({ title: "Clasificación actualizada" });
            onUpdate();
            onOpenChange(false);
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
             <DialogContent className="bg-[#1a1e23] border-gray-700 text-white max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Editar Clasificación de Plantilla</DialogTitle>
                    <DialogDescription>Define los ejes de clasificación para facilitar la búsqueda.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <ClassificationManager selectedValues={values} onChange={handleChange} />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-500 text-white">
                        {isSaving ? 'Guardando...' : 'Guardar Clasificación'}
                    </Button>
                </DialogFooter>
             </DialogContent>
        </Dialog>
    );
};

const TemplateCard = ({ template, onDelete, onAssign, onUpdate, onPromote, isAdmin, currentUserCenterId }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isRestrictionsOpen, setIsRestrictionsOpen] = useState(false);
    const [isClassificationOpen, setIsClassificationOpen] = useState(false);
    const [centerName, setCenterName] = useState('');
    
    // Use creator data passed from parent
    const creatorName = template.creator_data?.name;
    const creatorRole = template.creator_data?.role;
    const isCreator = user?.id === template.created_by;

    useEffect(() => {
        const fetchRelatedData = async () => {
            if (template.template_scope === 'center' && template.center_id) {
                const { data } = await supabase.from('centers').select('name').eq('id', template.center_id).maybeSingle();
                if (data) setCenterName(data.name);
            }
        };
        fetchRelatedData();
    }, [template.template_scope, template.center_id]);

    const handleCardClick = (e) => {
        if (e.target.closest('button, a, [role="dialog"], [role="tooltip"]')) {
            return;
        }
        navigate(`/admin-panel/plan-detail/${template.id}`);
    };

    const stopPropagation = (e) => e.stopPropagation();

    const assignedPlans = useMemo(() => template.assigned_plans || [], [template.assigned_plans]);

    const sensitivitiesText = useMemo(() => 
        template.sensitivities?.map(s => s.sensitivities?.name || s.name).filter(Boolean).join(', ') || '',
        [template.sensitivities]
    );

    const conditionsText = useMemo(() =>
        template.medical_conditions?.map(c => c.medical_conditions?.name || c.name).filter(Boolean).join(', ') || '',
        [template.medical_conditions]
    );

    const classifications = [
        ...(template.classification_objective || []).map(v => ({ type: 'objective', value: v })),
        ...(template.classification_lifestyle || []).map(v => ({ type: 'lifestyle', value: v })),
        ...(template.classification_nutrition_style || []).map(v => ({ type: 'nutrition_style', value: v }))
    ];
    
    const displayTags = classifications.slice(0, 5);
    const remainingTags = classifications.length - 5;

    // Permission checks
    const isGlobal = template.template_scope === 'global';
    const isCenter = template.template_scope === 'center';
    const canDelete = isAdmin || (isCenter && template.center_id === currentUserCenterId);
    const canPromote = isAdmin && isCenter;

    return (
        <TooltipProvider>
            <div onClick={handleCardClick} className="relative group h-full">
                <div className="w-full h-full text-left bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-5 rounded-xl hover:shadow-green-500/10 transition-all flex flex-col justify-between shadow-lg border border-slate-700/50 cursor-pointer hover:border-green-500/30">
                    <div className="flex-grow space-y-4">
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex flex-col gap-1 flex-grow">
                                <div className="flex items-center gap-2">
                                    {isGlobal ? (
                                        <Badge className="bg-blue-900/30 text-blue-300 border-blue-500/30 text-[10px] px-1.5 py-0 h-5 mb-2">
                                            <Globe className="w-3 h-3 mr-1"/> Global
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-amber-900/50 text-amber-300 border-amber-500/30 text-[10px] px-1.5 py-0 h-5 mb-2">
                                            <Building2 className="w-3 h-3 mr-1"/> {centerName || 'Centro'}
                                        </Badge>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-white leading-tight line-clamp-2">{template.name}</h3>
                                {creatorRole === 'coach' && (isCreator || creatorName) && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        {isCreator ? 'Creado por ti' : `Creado por: ${creatorName}`}
                                    </p>
                                )}
                            </div>
                            {canDelete && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-gray-400 hover:text-white -mt-1 -mr-2" 
                                    onClick={(e) => { stopPropagation(e); setIsClassificationOpen(true); }}
                                >
                                    <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>

                        {/* Classification Tags */}
                        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                             {displayTags.length > 0 ? (
                                <>
                                    {displayTags.map((tag, i) => (
                                        <ClassificationBadge key={i} type={tag.type} value={tag.value} />
                                    ))}
                                    {remainingTags > 0 && (
                                         <Badge variant="secondary" className="text-xs bg-slate-800 text-gray-400">+{remainingTags}</Badge>
                                    )}
                                </>
                             ) : (
                                 <span className="text-xs text-gray-500 italic flex items-center gap-1"><Tag className="w-3 h-3"/> Sin clasificar</span>
                             )}
                        </div>
                        
                        <Dialog open={isRestrictionsOpen} onOpenChange={setIsRestrictionsOpen}>
                            <DialogTrigger asChild onClick={stopPropagation}>
                                <div className="space-y-2 pt-2 border-t border-slate-800/50">
                                    {sensitivitiesText && (
                                        <Badge variant="outline" className="cursor-pointer w-full justify-start text-left h-auto py-1.5 group/badge border-orange-900/30 bg-orange-900/10 hover:bg-orange-900/20 hover:border-orange-500/50 pl-2">
                                            <ShieldAlert className="w-4 h-4 mr-2 flex-shrink-0 text-orange-400 group-hover/badge:text-orange-300 transition-colors" />
                                            <span className="font-semibold mr-1 text-orange-400 group-hover/badge:text-orange-300 transition-colors">Evita:</span>
                                            <span className="truncate text-gray-400 group-hover/badge:text-gray-300 transition-colors text-xs">{sensitivitiesText}</span>
                                        </Badge>
                                    )}
                                    {conditionsText && (
                                        <Badge variant="outline" className="cursor-pointer w-full justify-start text-left h-auto py-1.5 group/badge border-red-900/30 bg-red-900/10 hover:bg-red-900/20 hover:border-red-500/50 pl-2">
                                            <HeartPulse className="w-4 h-4 mr-2 flex-shrink-0 text-red-400 group-hover/badge:text-red-300 transition-colors" />
                                            <span className="font-semibold mr-1 text-red-400 group-hover/badge:text-red-300 transition-colors">Apta para:</span>
                                            <span className="truncate text-gray-400 group-hover/badge:text-gray-300 transition-colors text-xs">{conditionsText}</span>
                                        </Badge>
                                    )}
                                    {!sensitivitiesText && !conditionsText && (
                                        <p className="text-xs text-gray-500 italic">Sin restricciones médicas o sensibilidades configuradas.</p>
                                    )}
                                </div>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-3xl">
                                <RestrictionsManager 
                                    entityId={template.id}
                                    entityType="diet_plans"
                                    onUpdate={() => {
                                        onUpdate();
                                        setIsRestrictionsOpen(false);
                                    }}
                                />
                            </DialogContent>
                        </Dialog>

                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 mb-2 mt-2 flex items-center gap-1 uppercase tracking-wide">
                                <UserCheck className="w-3 h-3" />
                                Asignaciones ({assignedPlans.length})
                            </h4>
                            {assignedPlans.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {assignedPlans.slice(0, 3).map(plan => (
                                        <TooltipProvider key={plan.id}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Link to={`/admin/manage-diet/${plan.profile.user_id}`} onClick={stopPropagation}>
                                                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-green-900/40 bg-green-900/10 text-green-400/80 hover:bg-green-900/30 hover:text-green-300 transition-colors cursor-pointer">
                                                            {plan.profile.full_name.split(' ')[0]}
                                                        </Badge>
                                                    </Link>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-slate-800 border-slate-700 text-white">
                                                    <p>Ver plan de {plan.profile.full_name}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ))}
                                    {assignedPlans.length > 3 && <span className="text-[10px] text-gray-500 self-center">+{assignedPlans.length - 3}</span>}
                                </div>
                            ) : (
                                <p className="text-[10px] text-gray-600 italic pl-4">Sin asignaciones.</p>
                            )}
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-end gap-2">
                         {canPromote && (
                             <Tooltip>
                                <TooltipTrigger asChild>
                                     <Button size="icon" variant="outline" onClick={(e) => { stopPropagation(e); onPromote(); }} className="h-8 w-8 bg-blue-700/30 text-blue-300 border-blue-900/50 hover:bg-blue-900/20 hover:text-blue-300">
                                        <ArrowUpCircle className="w-4 h-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-800 border-slate-700 text-white">
                                    <p>Promover a Global</p>
                                </TooltipContent>
                             </Tooltip>
                        )}
                        
                        {canDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-red-300 bg-red-700/30 hover:text-red-400 hover:bg-red-600/30 h-8 w-8" onClick={stopPropagation}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={stopPropagation} className="bg-slate-900 border-slate-700 text-white">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción no se puede deshacer. Esto eliminará permanentemente la plantilla y todos los datos asociados.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={(e) => { stopPropagation(e); onDelete(); }} className="bg-red-600 hover:bg-red-700">Continuar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <Button size="sm" onClick={(e) => { stopPropagation(e); onAssign(); }} className="bg-green-600 hover:bg-green-500 text-white h-8 text-xs">
                            <Copy className="w-3 h-3 mr-1.5"/> Asignar
                        </Button>
                    </div>
                </div>
                
                <ClassificationDialog 
                    template={template} 
                    open={isClassificationOpen} 
                    onOpenChange={setIsClassificationOpen}
                    onUpdate={onUpdate}
                />
            </div>
        </TooltipProvider>
    );
};

export default TemplateCard;