import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Link } from 'react-router-dom';
import { Loader2, UserCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const ActiveAdvices = () => {
    const { user } = useAuth();
    const [activeClients, setActiveClients] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchActiveClients = async () => {
        if (!user) return;
        setLoading(true);
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
            .from('diet_plans')
            .select('id, name, user_id, profile:user_id(full_name)')
            .eq('is_active', true)
            .lte('start_date', today)
            .gte('end_date', today);

        if (error) {
            console.error("Error fetching active clients:", error);
        } else {
            setActiveClients(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchActiveClients();

        const handleRefresh = () => {
            fetchActiveClients();
        };

        window.addEventListener('refreshActiveAdvices', handleRefresh);

        return () => {
            window.removeEventListener('refreshActiveAdvices', handleRefresh);
        };
    }, [user]);

    if (loading) {
        return (
            <Card className="bg-gray-800/50 border-gray-700 text-white shadow-lg">
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando asesorías...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gray-800/50 border-gray-700 text-white shadow-lg">
            <CardContent className="p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <UserCheck className="text-green-400" />
                    Asesorías Activas
                </h2>
                {activeClients.length > 0 ? (
                     <div className="flex flex-wrap gap-3">
                        {activeClients.map(client => (
                            <TooltipProvider key={client.id}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Link to={`/admin/manage-diet/${client.user_id}`}>
                                            <Badge variant="outline" className="text-base px-4 py-2 border-green-500/40 bg-green-900/30 text-green-300 hover:bg-green-800/40 transition-colors cursor-pointer">
                                                {client.profile.full_name}
                                            </Badge>
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-800 border-slate-700 text-white">
                                        <p>Plan: <span className="font-semibold">{client.name}</span></p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 px-6 bg-gray-800/50 rounded-lg flex items-center justify-center gap-3">
                        <Sparkles className="text-yellow-400" />
                        <p className="text-gray-400">No hay clientes con planes de dieta activos en este momento.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ActiveAdvices;