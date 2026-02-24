import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Weight, Calendar, HeartPulse, ShieldAlert, User, Cake, Apple } from 'lucide-react';
import { calculateAge } from '@/lib/metabolismCalculator';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import RestrictionsManager from '@/components/admin/diet-plans/RestrictionsManager';
import { Link } from 'react-router-dom';
import InfoBadge from '@/components/shared/InfoBadge';

const InfoItem = ({ icon, label, value, valueClassName, children, asLink, to }) => {
    const content = (
        <div className={`flex items-start space-x-3 ${asLink ? 'hover:bg-gray-700/50 p-2 -m-2 rounded-lg transition-colors' : ''}`}>
            <div className="bg-gray-700/50 p-2 rounded-lg">{icon}</div>
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                {children ? children : <p className={`font-semibold text-white ${valueClassName}`}>{value || 'N/A'}</p>}
            </div>
        </div>
    );

    if (asLink) {
        return <Link to={to}>{content}</Link>;
    }
    return content;
};

const ClientDietSummary = ({ client, dietPlans, onPlanUpdate, loading }) => {
    const { toast } = useToast();
    const [activePlan, setActivePlan] = useState(null);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [isRestrictionsOpen, setIsRestrictionsOpen] = useState(false);

    const todayDateString = format(new Date(), 'yyyy-MM-dd');
    
    useEffect(() => {
        const currentActivePlan = dietPlans.find(p => p.is_active);
        setActivePlan(currentActivePlan);
        if (currentActivePlan) {
            setStartDate(currentActivePlan.start_date ? parseISO(currentActivePlan.start_date) : null);
            setEndDate(currentActivePlan.end_date ? parseISO(currentActivePlan.end_date) : null);
        }
    }, [dietPlans]);

    const handleDateChange = async (dates) => {
        const [start, end] = dates;
        setStartDate(start);
        setEndDate(end);

        if (start && end && activePlan) {
            const { error } = await supabase
                .from('diet_plans')
                .update({ 
                    start_date: format(start, 'yyyy-MM-dd'),
                    end_date: format(end, 'yyyy-MM-dd')
                })
                .eq('id', activePlan.id);

            if (error) {
                toast({ title: 'Error', description: 'No se pudo actualizar el rango de fechas.', variant: 'destructive' });
            } else {
                toast({ title: 'Éxito', description: 'Rango de fechas actualizado.' });
                onPlanUpdate();
            }
        }
    };

    if (loading) {
        return <Skeleton className="h-96 w-full bg-gray-800" />;
    }

    if (!client) {
        return (
            <Card className="bg-gray-800/50 border-gray-700 text-white">
                <CardContent className="p-6">
                    <p>No se encontraron datos del cliente.</p>
                </CardContent>
            </Card>
        );
    }

    const age = calculateAge(client.birth_date);
    const birthDateFormatted = client.birth_date ? format(parseISO(client.birth_date), 'dd MMMM, yyyy', { locale: es }) : 'N/A';

    const pathologies = client.user_medical_conditions?.map(mc => mc.medical_conditions).filter(Boolean) || [];
    const sensitivities = client.user_sensitivities?.map(s => s.sensitivities).filter(Boolean) || [];

    return (
        <Card className="bg-gray-800/50 border-gray-700 text-white shadow-lg">
            <CardContent className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <InfoItem icon={<User className="w-5 h-5 text-green-400" />} label="Cliente" value={client.full_name} asLink to={`/client-profile/${client.user_id}`} />
                        <InfoItem icon={<Apple className="w-5 h-5 text-green-400" />} label="Plan de Dieta" asLink to={`/plan/dieta/${client.user_id}/${todayDateString}`}>
                            <p className="font-semibold text-white">Ir al Plan de Dieta</p>
                        </InfoItem>
                        <InfoItem icon={<Weight className="w-5 h-5 text-sky-400" />} label="Peso Actual" value={`${client.current_weight_kg || 'N/A'} kg`} />
                        {client.goal_weight_kg && <InfoItem icon={<Target className="w-5 h-5 text-yellow-400" />} label="Peso Objetivo" value={`${client.goal_weight_kg} kg`} />}
                        <InfoItem icon={<Calendar className="w-5 h-5 text-purple-400" />} label="Edad" value={`${age || 'N/A'} años`} />
                        <InfoItem icon={<Cake className="w-5 h-5 text-pink-400" />} label="Fecha de Nacimiento" value={birthDateFormatted} />
                        
                        <div className="sm:col-span-2 space-y-4">
                            <Dialog open={isRestrictionsOpen} onOpenChange={setIsRestrictionsOpen}>
                                <DialogTrigger asChild>
                                    <div className="space-y-4 cursor-pointer group">
                                        <InfoItem icon={<ShieldAlert className="w-5 h-5 text-orange-400" />} label="Sensibilidades">
                                            {sensitivities.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                    {sensitivities.map(s => <InfoBadge key={s.id} item={s} type="sensitivity" />)}
                                                </div>
                                            ) : <p className="font-semibold text-white">Ninguna</p>}
                                        </InfoItem>
                                        <InfoItem icon={<HeartPulse className="w-5 h-5 text-red-400" />} label="Patologías">
                                            {pathologies.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                    {pathologies.map(p => <InfoBadge key={p.id} item={p} type="medical_condition" />)}
                                                </div>
                                            ) : <p className="font-semibold text-white">Ninguna</p>}
                                        </InfoItem>
                                    </div>
                                </DialogTrigger>
                                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-3xl">
                                    <RestrictionsManager 
                                        entityId={client.user_id}
                                        entityType="profiles"
                                        onUpdate={() => {
                                            onPlanUpdate();
                                            setIsRestrictionsOpen(false);
                                        }}
                                    />
                                </DialogContent>
                            </Dialog>
                             <InfoItem icon={<Calendar className="w-5 h-5 text-indigo-400" />} label="Rango de la Dieta Activa">
                                {activePlan ? (
                                    <DatePicker
                                        selected={startDate}
                                        onChange={handleDateChange}
                                        startDate={startDate}
                                        endDate={endDate}
                                        selectsRange
                                        dateFormat="dd/MM/yyyy"
                                        locale={es}
                                        customInput={
                                            <div className="font-semibold text-white bg-gray-700/50 border border-gray-600 rounded-md px-3 py-1.5 cursor-pointer hover:bg-gray-700 transition-colors w-full text-center">
                                                {startDate && endDate ? `${format(startDate, 'dd/MM/yy')} - ${format(endDate, 'dd/MM/yy')}` : 'Seleccionar rango'}
                                            </div>
                                        }
                                        wrapperClassName="w-full"
                                        popperClassName="z-50"
                                    />
                                ) : <p className="font-semibold text-white">No hay plan activo</p>}
                            </InfoItem>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ClientDietSummary;