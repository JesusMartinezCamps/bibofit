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
import { Trash2, Copy, UserCheck, ShieldAlert, HeartPulse, Tag, Edit2, Globe, Building2, ArrowUpCircle, Share2, Check, Eye } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import TemplatePreviewModal from '@/components/admin/diet-plans/TemplatePreviewModal';

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

const TemplateCard = ({ 
    template, 
    onDelete, 
    onAssign, 
    onUpdate, 
    onPromote, 
    onAssignToCenter, 
    isAdmin, 
    currentUserCenterId, 
    onCardClick,
    allowManagement = true,
    assignDisabled = false,
    isActive = false,
    isUserHasActiveDiet = false,
    userDayMeals // New prop for preview filtering
}) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isRestrictionsOpen, setIsRestrictionsOpen] = useState(false);
    const [isClassificationOpen, setIsClassificationOpen] = useState(false);
    const [centerName, setCenterName] = useState('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    
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
        // Prevent click if clicking on interactive elements
        if (e.target.closest('button, a, [role="tooltip"], [data-radix-collection-item]')) {
            return;
        }
        
        if (onCardClick) {
            onCardClick(template);
        } else {
            // Default behavior: Open Preview
            setIsPreviewOpen(true);
        }
    };

    const stopPropagation = (e) => {
        if (e) {
            e.stopPropagation();
        }
    };

    const assignedPlans = useMemo(() => template.assigned_plans || [], [template.assigned_plans]);
    
    // Assigned Centers (for global templates)
    const assignedCenters = useMemo(() => template.assigned_centers?.map(ac => ac.center).filter(Boolean) || [], [template.assigned_centers]);

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
    const canManage = allowManagement && (isAdmin || (isCenter && template.center_id === currentUserCenterId));
    const canDelete = canManage && (isAdmin || (isCenter && template.center_id === currentUserCenterId));
    const canPromote = allowManagement && isAdmin && isCenter;
    const canAssignToCenter = allowManagement && isAdmin && isGlobal;
    const canEditClassification = allowManagement && canDelete;
    const canOpenRestrictions = allowManagement;

    const renderActionButton = () => {
        // High priority: Active Plan (User View)
        if (isActive) {
             return (
                 <Button 
                    size="sm" 
                    onClick={(e) => { stopPropagation(e); navigate('/my-plan'); }} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs z-10 relative shadow-sm ring-2 ring-emerald-500/50"
                    >
                    <Check className="w-3 h-3 mr-1.5" /> Tu Dieta Activa
                </Button>
            );
        }

        // If not management (User View)
        if (!allowManagement) {
             return (
                <Button 
                    size="sm" 
                    onClick={(e) => { stopPropagation(e); onAssign(); }} 
                    className={cn(
                        "text-white h-8 text-xs z-10 relative transition-all duration-200",
                        isUserHasActiveDiet 
                            ? "bg-gray-700 text-gray-400 cursor-not-allowed hover:bg-gray-700" 
                            : "bg-green-700 hover:bg-green-600"
                    )}
                    disabled={isUserHasActiveDiet}
                >
                    <Copy className="w-3 h-3 mr-1.5" /> 
                    {isUserHasActiveDiet ? 'Ya tienes un plan' : 'Elegir esta dieta'}
                </Button>
            );
        }
        
        // Admin View (allowManagement = true)
        return (
            <Button 
                size="sm" 
                onClick={(e) => { stopPropagation(e); onAssign(); }} 
                className="bg-green-700 hover:bg-green-500 text-white h-8 text-xs z-10 relative"
                disabled={assignDisabled}
            >
                <Copy className="w-3 h-3 mr-1.5" /> Usar esta plantilla
            </Button>
        );
    };

    return (
        <TooltipProvider>
            <div 
                onClick={handleCardClick} 
                className="relative group h-full w-full outline-none"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        handleCardClick(e);
                    }
                }}
            >
                <div className={cn(
                    "w-full h-full text-left bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-5 rounded-xl transition-all flex flex-col justify-between shadow-lg border cursor-pointer hover:border-blue-500/30 hover:shadow-blue-500/10",
                    isActive 
                        ? "border-emerald-500/50 shadow-emerald-500/10 from-emerald-950/20 to-slate-900" 
                        : "border-slate-700/50"
                )}>
                    {isActive && (
                        <div className="absolute top-0 right-0 p-3 z-10">
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 pointer-events-none">Activa</Badge>
                        </div>
                    )}

                    <div className="flex-grow space-y-4 z-10 relative">
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex flex-col gap-1 flex-grow pr-16">
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
                                <h3 className="text-lg font-bold text-white leading-tight line-clamp-2 group-hover:text-blue-200 transition-colors">{template.name}</h3>
                                {creatorRole === 'coach' && (isCreator || creatorName) && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        {isCreator ? 'Creado por ti' : `Creado por: ${creatorName}`}
                                    </p>
                                )}
                            </div>
                            {canEditClassification && (
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
                        
                        {canOpenRestrictions ? (
                            <Dialog open={isRestrictionsOpen} onOpenChange={setIsRestrictionsOpen}>
                                <DialogTrigger asChild onClick={stopPropagation}>
                                    <div className="space-y-2 pt-2 border-t border-slate-800/50 cursor-default">
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
                                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-3xl" onClick={(e) => e.stopPropagation()}>
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
                        ) : (
                            <div className="space-y-2 pt-2 border-t border-slate-800/50 cursor-default">
                                {sensitivitiesText && (
                                    <Badge variant="outline" className="w-full justify-start text-left h-auto py-1.5 group/badge border-orange-900/30 bg-orange-900/10 pl-2">
                                        <ShieldAlert className="w-4 h-4 mr-2 flex-shrink-0 text-orange-400" />
                                        <span className="font-semibold mr-1 text-orange-400">Evita:</span>
                                        <span className="truncate text-gray-400 text-xs">{sensitivitiesText}</span>
                                    </Badge>
                                )}
                                {conditionsText && (
                                    <Badge variant="outline" className="w-full justify-start text-left h-auto py-1.5 group/badge border-red-900/30 bg-red-900/10 pl-2">
                                        <HeartPulse className="w-4 h-4 mr-2 flex-shrink-0 text-red-400" />
                                        <span className="font-semibold mr-1 text-red-400">Apta para:</span>
                                        <span className="truncate text-gray-400 text-xs">{conditionsText}</span>
                                    </Badge>
                                )}
                                {!sensitivitiesText && !conditionsText && (
                                    <p className="text-xs text-gray-500 italic">Sin restricciones médicas o sensibilidades configuradas.</p>
                                )}
                            </div>
                        )}
                        
                        {/* Assigned Centers Display */}
                        {isGlobal && assignedCenters.length > 0 && (
                            <div className="pt-2">
                                <h4 className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1 uppercase tracking-wide">
                                    <Building2 className="w-3 h-3" />
                                    Organizaciones ({assignedCenters.length})
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                    {assignedCenters.slice(0, 3).map(center => (
                                        <Badge key={center.id} variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-800/50 border-slate-700 text-gray-300">
                                            {center.name}
                                        </Badge>
                                    ))}
                                    {assignedCenters.length > 3 && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-800/50 border-slate-700 text-gray-400">
                                            +{assignedCenters.length - 3}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}

                        {allowManagement && (
                            <div>
                                <h4 className="text-xs font-semibold text-gray-500 mb-2 mt-2 flex items-center gap-1 uppercase tracking-wide">
                                    <UserCheck className="w-3 h-3" />
                                    Asignaciones ({assignedPlans.length})
                                </h4>
                                {assignedPlans.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {assignedPlans.slice(0, 3).map(plan => (
                                            allowManagement ? (
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
                                            ) : (
                                                <Badge key={plan.id} variant="outline" className="text-[10px] px-2 py-0.5 border-green-900/40 bg-green-900/10 text-green-400/80">
                                                    {plan.profile.full_name.split(' ')[0]}
                                                </Badge>
                                            )
                                        ))}
                                        {assignedPlans.length > 3 && <span className="text-[10px] text-gray-500 self-center">+{assignedPlans.length - 3}</span>}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-gray-600 italic pl-4">Sin asignaciones.</p>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-end gap-2 z-10 relative">
                        {allowManagement && canAssignToCenter && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="outline" onClick={(e) => { stopPropagation(e); onAssignToCenter(); }} className="h-8 w-8 bg-purple-700/30 text-purple-300 border-purple-900/50 hover:bg-purple-900/20 hover:text-purple-300">
                                        <Share2 className="w-4 h-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-800 border-slate-700 text-white">
                                    <p>Asignar a Organización</p>
                                </TooltipContent>
                            </Tooltip>
                        )}

                         {allowManagement && canPromote && (
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
                        
                        {allowManagement && canDelete && (
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
                        {renderActionButton()}
                    </div>
                </div>
                
                {canEditClassification && (
                    <ClassificationDialog
                        template={template}
                        open={isClassificationOpen}
                        onOpenChange={setIsClassificationOpen}
                        onUpdate={onUpdate}
                    />
                )}
                
                <TemplatePreviewModal
                    templateId={template.id}
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    userDayMeals={userDayMeals}
                    allowManagement={allowManagement}
                    onAssign={allowManagement ? undefined : () => { setIsPreviewOpen(false); onAssign(); }}
                />
            </div>
        </TooltipProvider>
    );
};

export default TemplateCard;