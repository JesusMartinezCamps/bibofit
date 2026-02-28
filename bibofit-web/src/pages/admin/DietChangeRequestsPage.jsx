import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import TabNavigation from '@/components/admin/UserCreatedFoods/TabNavigation';
import UserList from '@/components/admin/UserCreatedFoods/UserList';
import DietChangeRequestList from '@/components/admin/DietChangeRequests/DietChangeRequestList';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useNotifications } from '@/contexts/NotificationsContext';

const DietChangeRequestsPage = () => {
    const { toast } = useToast();
    const { refreshPendingRequests } = useNotifications();
    const [activeTab, setActiveTab] = useState('pending');
    const [usersByStatus, setUsersByStatus] = useState({
        pending: [],
        approved: [],
        rejected: []
    });
    const [selectedUser, setSelectedUser] = useState(null);
    const [userChangeRequests, setUserChangeRequests] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [allFoods, setAllFoods] = useState([]);
    const [clientRestrictions, setClientRestrictions] = useState({ conditions: [], sensitivities: [] });

    const fetchUsersData = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const { data: requests, error } = await supabase
                .from('diet_change_requests')
                .select('status, user_id');
            if (error) throw error;
            
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('user_id, full_name');
            if (profilesError) throw profilesError;

            const profilesMap = new Map(profiles.map(p => [p.user_id, p.full_name]));

            const statusMap = {
                pending: new Map(),
                approved: new Map(),
                rejected: new Map()
            };

            requests.forEach(request => {
                if (!profilesMap.has(request.user_id)) return;

                if (statusMap[request.status]) {
                    if (!statusMap[request.status].has(request.user_id)) {
                        statusMap[request.status].set(request.user_id, { 
                            user_id: request.user_id, 
                            full_name: profilesMap.get(request.user_id), 
                            count: 0 
                        });
                    }
                    const userEntry = statusMap[request.status].get(request.user_id);
                    userEntry.count++;
                }
            });

            setUsersByStatus({
                pending: Array.from(statusMap.pending.values()).map(u => ({...u, pending_count: u.count})),
                approved: Array.from(statusMap.approved.values()),
                rejected: Array.from(statusMap.rejected.values()),
            });

            const { data: foods, error: foodsError } = await supabase.from('food').select('*, food_sensitivities(sensitivity_id), food_medical_conditions(condition_id, relation_type)');
            if (foodsError) throw foodsError;
            setAllFoods(foods);

        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron cargar los datos de usuarios.', variant: 'destructive' });
        } finally {
            setLoadingUsers(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchUsersData();
    }, [fetchUsersData]);

    const handleSelectUser = useCallback(async (user, status) => {
        setSelectedUser(user);
        setLoadingRequests(true);
        try {
            let query = supabase
                .from('diet_change_requests')
                .select(`
                    *,
                    profile:profiles(full_name),
                    diet_plan_recipe:diet_plan_recipe_id(
                        *,
                        recipe:recipe_id(*, recipe_ingredients(*, food(*))),
                        custom_ingredients:diet_plan_recipe_ingredients(*, food(*))
                    ),
                    private_recipe:private_recipe_id(
                        *,
                        private_recipe_ingredients(*, food(*))
                    ),
                    requested_changes_recipe:requested_changes_private_recipe_id(
                        *,
                        private_recipe_ingredients(*, food(*))
                    )
                `)
                .eq('user_id', user.user_id);

            if (status === 'pending') query = query.eq('status', 'pending');
            else if (status === 'approved') query = query.eq('status', 'approved');
            else if (status === 'rejected') query = query.eq('status', 'rejected');

            const { data, error } = await query.order('requested_at', { ascending: false });
            if (error) throw error;
            setUserChangeRequests(data);

            const { data: conditionsData, error: conditionsError } = await supabase.from('user_medical_conditions')
                .select('medical_conditions(id, name)')
                .eq('user_id', user.user_id);
            if (conditionsError) throw conditionsError;

            const { data: sensitivitiesData, error: sensitivitiesError } = await supabase.from('user_sensitivities')
                .select('sensitivities(id, name)')
                .eq('user_id', user.user_id);
            if (sensitivitiesError) throw sensitivitiesError;
            
            setClientRestrictions({
                conditions: conditionsData.map(c => c.medical_conditions),
                sensitivities: sensitivitiesData.map(s => s.sensitivities),
            });


        } catch (error) {
            toast({ title: 'Error', description: `No se pudieron cargar las solicitudes de ${user.full_name}.`, variant: 'destructive' });
        } finally {
            setLoadingRequests(false);
        }
    }, [toast]);

    const handleActionComplete = useCallback(() => {
        fetchUsersData();
        if (selectedUser) {
            handleSelectUser(selectedUser, activeTab);
        }
        refreshPendingRequests();
    }, [fetchUsersData, selectedUser, handleSelectUser, activeTab, refreshPendingRequests]);

    const handleTabChange = (value) => {
        setActiveTab(value);
        setSelectedUser(null);
        setUserChangeRequests([]);
        setClientRestrictions({ conditions: [], sensitivities: [] });
    };

    const getCurrentUsers = () => {
        return usersByStatus[activeTab] || [];
    };

    const breadcrumbItems = [
        { label: 'Gestión de Contenidos', href: '/admin-panel/content/nutrition' },
        { label: 'Nutrición', href: '/admin-panel/content/nutrition' },
        { label: 'Solicitudes de Cambios de Recetas' },
    ];
    
    const tabOptions = [
        { value: 'pending', label: 'Pendientes' },
        { value: 'approved', label: 'Aprobadas' },
        { value: 'rejected', label: 'Rechazadas' }
    ];

    return (
        <>
            <Helmet>
                <title>Solicitudes de Cambio de Recetas</title>
                <meta name="description" content="Gestiona las solicitudes de cambio de recetas de tus clientes." />
            </Helmet>
            <main className="container mx-auto px-4 py-8">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <Breadcrumbs items={breadcrumbItems} />
                    <div className="flex justify-between items-center my-4">
                        <h1 className="text-3xl font-bold text-white">Solicitudes de Cambio de Recetas</h1>
                    </div>

                    <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} tabs={tabOptions}/>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <UserList
                            users={getCurrentUsers()}
                            loading={loadingUsers}
                            selectedUser={selectedUser}
                            onSelectUser={handleSelectUser}
                            activeTab={activeTab}
                        />

                        <DietChangeRequestList
                            userChangeRequests={userChangeRequests}
                            loadingRequests={loadingRequests}
                            selectedUser={selectedUser}
                            activeTab={activeTab}
                            onActionComplete={handleActionComplete}
                            allFoods={allFoods}
                            clientRestrictions={clientRestrictions}
                        />
                    </div>
                </motion.div>
            </main>
        </>
    );
};

export default DietChangeRequestsPage;