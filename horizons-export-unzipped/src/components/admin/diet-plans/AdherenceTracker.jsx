import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

const AdherenceTracker = ({ userId }) => {
    const [adherenceData, setAdherenceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [weeklyRatio, setWeeklyRatio] = useState(0);

    useEffect(() => {
        const fetchAdherenceData = async () => {
            if (!userId) return;
            setLoading(true);
            const today = new Date();
            const sevenDaysAgo = subDays(today, 6);
            
            const { data, error } = await supabase
                .from('plan_adherence_logs')
                .select('*')
                .eq('user_id', userId)
                .gte('log_date', format(sevenDaysAgo, 'yyyy-MM-dd'))
                .lte('log_date', format(today, 'yyyy-MM-dd'))
                .order('log_date', { ascending: true });

            if (error) {
                console.error("Error fetching adherence data:", error);
            } else {
                setAdherenceData(data);
                if (data.length > 0) {
                    const totalPlanned = data.reduce((sum, item) => sum + item.planned_meals_count, 0);
                    const totalConsumed = data.reduce((sum, item) => sum + item.consumed_meals_count, 0);
                    setWeeklyRatio(totalPlanned > 0 ? (totalConsumed / totalPlanned) * 100 : 0);
                } else {
                    setWeeklyRatio(0);
                }
            }
            setLoading(false);
        };

        fetchAdherenceData();
    }, [userId]);

    if (loading) {
        return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-green-400" /></div>;
    }

    const maxPlanned = Math.max(...adherenceData.map(d => d.planned_meals_count), 0);

    return (
        <Card className="bg-slate-900/50 border-gray-700 text-white">
            <CardHeader>
                <CardTitle>Seguimiento de Adherencia (Últimos 7 días)</CardTitle>
                <div className="flex items-center gap-4 mt-2">
                    <p className="text-3xl font-bold" style={{ color: weeklyRatio > 75 ? '#22c55e' : weeklyRatio > 50 ? '#f59e0b' : '#ef4444' }}>
                        {weeklyRatio.toFixed(1)}%
                    </p>
                    <div className="flex flex-col">
                        <span className="text-sm text-gray-400">Ratio Semanal</span>
                        {weeklyRatio > 75 ? <TrendingUp className="text-green-500" /> : <TrendingDown className="text-red-500" />}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between h-48 gap-3" >
                     {adherenceData.map(day => (
                        <div key={day.log_date} className="flex flex-col items-center justify-end flex-1 gap-1">
                            <AnimatePresence>
                                <div className="relative w-full h-full flex flex-row items-end justify-center gap-2">
                                     <motion.div
                                        className="w-1/2 bg-blue-900/50 rounded-t-md"
                                        initial={{ height: 0 }}
                                        animate={{ height: `${(day.planned_meals_count / (maxPlanned || 1)) * 100}%` }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                        title={`Planificadas: ${day.planned_meals_count}`}
                                    />
                                    <motion.div
                                        className="w-1/2 bg-green-500 rounded-t-md"
                                        initial={{ height: 0 }}
                                        animate={{ height: `${(day.consumed_meals_count / (maxPlanned || 1)) * 100}%` }}
                                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                                        title={`Comidas: ${day.consumed_meals_count}`}
                                    />
                                </div>
                            </AnimatePresence>
                            <span className="text-xs text-gray-400 capitalize pt-1">{format(new Date(day.log_date), 'EEE', { locale: es })}</span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-900/50 rounded-sm"></div><span className="text-sm text-gray-300">Planificadas</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-sm"></div><span className="text-sm text-gray-300">Consumidas</span></div>
                </div>
            </CardContent>
        </Card>
    );
};

export default AdherenceTracker;