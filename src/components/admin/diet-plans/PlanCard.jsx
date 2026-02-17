import React, { useState, useMemo } from 'react';
    import { Button } from '@/components/ui/button';
    import { Badge } from '@/components/ui/badge';
    import { Calendar, Trash2, ToggleLeft, ToggleRight, ShieldAlert, HeartPulse } from 'lucide-react';
    import { format, isValid, parseISO } from 'date-fns';
    import { es } from 'date-fns/locale';
    import { useNavigate } from 'react-router-dom';
    import DatePicker from 'react-datepicker';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/supabaseClient';
    import {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle,
    } from "@/components/ui/alert-dialog";
    
    const PlanCard = ({ plan, onToggleActive, onDelete, client, onPlanUpdate }) => {
        const navigate = useNavigate();
        const { toast } = useToast();
        const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
        const [isToggling, setIsToggling] = useState(false);
        const [startDate, setStartDate] = useState(plan.start_date ? parseISO(plan.start_date) : null);
        const [endDate, setEndDate] = useState(plan.end_date ? parseISO(plan.end_date) : null);
    
        const handleCardClick = (e) => {
            if (e.target.closest('button, a, [role="dialog"], [role="tooltip"], .react-datepicker-wrapper')) {
                return;
            }
            navigate(`/admin-panel/plan-detail/${plan.id}`);
        };
    
        const stopPropagation = (e) => e.stopPropagation();
    
        const handleToggleClick = async (e) => {
            stopPropagation(e);
            setIsToggling(true);
            await onToggleActive(plan.id, !plan.is_active);
            setIsToggling(false);
        };
    
        const handleDateChange = async (dates) => {
            const [start, end] = dates;
            setStartDate(start);
            setEndDate(end);
    
            if (start && end && plan) {
                const { error } = await supabase
                    .from('diet_plans')
                    .update({ 
                        start_date: format(start, 'yyyy-MM-dd'),
                        end_date: format(end, 'yyyy-MM-dd')
                    })
                    .eq('id', plan.id);
    
                if (error) {
                    toast({ title: 'Error', description: 'No se pudo actualizar el rango de fechas.', variant: 'destructive' });
                } else {
                    toast({ title: 'Éxito', description: 'Rango de fechas actualizado.' });
                    if (onPlanUpdate) onPlanUpdate();
                }
            }
        };
    
        const clientSensitivities = useMemo(() => client?.user_sensitivities?.map(s => s.sensitivities.name).join(', ') || '', [client]);
        const clientConditions = useMemo(() => client?.user_medical_conditions?.map(c => c.medical_conditions.name).join(', ') || '', [client]);
    
        const handleDeleteClick = (e) => {
            stopPropagation(e);
            setIsDeleteDialogOpen(true);
        };
    
        const confirmDelete = (e) => {
            stopPropagation(e);
            onDelete(plan.id);
            setIsDeleteDialogOpen(false);
        };
    
        return (
            <>
                <div onClick={handleCardClick} className="relative group h-full">
                    <div className="w-full h-full text-left bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-5 rounded-xl hover:shadow-green-500/10 transition-all flex flex-col justify-between shadow-lg border border-slate-700/50 cursor-pointer">    
                        <div className="flex-grow space-y-4">
                            <div>
                                 <h3 className="text-xl font-bold text-white line-clamp-2">{plan.name}</h3>
                                {plan.source_template?.name && (
                                    <p className="text-sm text-gray-400 mt-1">
                                        Basada en: <span className="font-semibold text-gray-300">{plan.source_template.name}</span>
                                    </p>
                                )}
                            </div>
    
                            <div className="space-y-2">
                                 {clientSensitivities && (
                                    <Badge variant="silver" className="w-full justify-start text-left h-auto py-1.5 group/badge hover:border-orange-500/50">
                                        <ShieldAlert className="w-4 h-4 mr-2 flex-shrink-0 text-orange-400 group-hover/badge:text-orange-300 transition-colors" />
                                        <span className="font-semibold mr-1 text-orange-400 group-hover/badge:text-orange-300 transition-colors">Evita:</span>
                                        <span className="truncate text-gray-300 group-hover/badge:text-white transition-colors">{clientSensitivities}</span>
                                    </Badge>
                                )}
                                {clientConditions && (
                                    <Badge variant="silver" className="w-full justify-start text-left h-auto py-1.5 group/badge hover:border-red-500/50">
                                        <HeartPulse className="w-4 h-4 mr-2 flex-shrink-0 text-red-400 group-hover/badge:text-red-300 transition-colors" />
                                        <span className="font-semibold mr-1 text-red-400 group-hover/badge:text-red-300 transition-colors">Apta para:</span>
                                        <span className="truncate text-gray-300 group-hover/badge:text-white transition-colors">{clientConditions}</span>
                                    </Badge>
                                )}
                            </div>
                            
                             <div onClick={stopPropagation}>
                                <DatePicker
                                    selected={startDate}
                                    onChange={handleDateChange}
                                    startDate={startDate}
                                    endDate={endDate}
                                    selectsRange
                                    dateFormat="dd/MM/yyyy"
                                    locale={es}
                                    customInput={
                                        <Badge variant="outline" className="text-violet-300 border-violet-500/50 bg-violet-900/30 w-full justify-center cursor-pointer hover:bg-violet-800/40">
                                            <Calendar className="w-3 h-3 mr-1.5" />
                                            {startDate && endDate ? `${format(startDate, 'd MMM', { locale: es })} - ${format(endDate, 'd MMM yyyy', { locale: es })}` : 'Seleccionar rango'}
                                        </Badge>
                                    }
                                    wrapperClassName="w-full"
                                    popperClassName="z-50"
                                />
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={handleToggleClick}
                                disabled={isToggling}
                                className={`flex items-center gap-2 px-2 py-1 h-auto text-xs rounded-full ${plan.is_active ? 'text-green-300 bg-green-900/50 hover:text-green-200 hover:bg-green-800/60' : 'text-gray-400 bg-gray-700/50 hover:text-gray-300 hover:bg-gray-600/60'}`}
                            >
                                {plan.is_active ? <ToggleRight className="w-4 h-4"/> : <ToggleLeft className="w-4 h-4"/>}
                                {plan.is_active ? 'Activa' : 'Inactiva'}
                            </Button>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={handleDeleteClick}
                                className="text-red-400 hover:bg-red-800/70 hover:text-red-300 h-8 w-8"
                            >
                                <Trash2 className="w-4 h-4"/>
                            </Button>
                        </div>
                    </div>
                </div>
    
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent onClick={stopPropagation} className="bg-slate-900 border-slate-700 text-white">
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Confirmas la eliminación?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Estás a punto de eliminar el plan "{plan.name}". Esta acción es irreversible y borrará todas las recetas y configuraciones asociadas a este plan específico.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={(e) => stopPropagation(e)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </>
        );
    };
    
    export default PlanCard;