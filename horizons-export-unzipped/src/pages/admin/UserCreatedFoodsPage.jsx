import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import UserList from '@/components/admin/UserCreatedFoods/UserList';
import FoodsList from '@/components/admin/UserCreatedFoods/FoodsList';
import TabNavigation from '@/components/admin/UserCreatedFoods/TabNavigation';
import { useNotifications } from '@/contexts/NotificationsContext';

const TABS = [
  { id: 'pending', name: 'Pendientes' },
  { id: 'approved', name: 'Aprobados' },
  { id: 'rejected', name: 'Rechazados' },
];

const UserCreatedFoodsPage = () => {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [foods, setFoods] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const { toast } = useToast();
  const { pendingFoodCount, refreshPendingRequests } = useNotifications();

  const fetchUsersWithPendingFoods = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.rpc('get_users_with_pending_foods_count');
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      toast({ title: 'Error', description: `No se pudieron cargar los usuarios: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoadingUsers(false);
    }
  }, [toast]);

  const fetchFoodsForUser = useCallback(async (user, tab) => {
    if (!user) return;
    setLoadingFoods(true);
    try {
      const { data, error } = await supabase
        .from('user_created_foods')
        .select('*')
        .eq('user_id', user.user_id)
        .eq('status', tab)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFoods(data || []);
    } catch (error) {
      toast({ title: 'Error', description: `No se pudieron cargar los alimentos: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoadingFoods(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsersWithPendingFoods();
  }, [fetchUsersWithPendingFoods]);

  const handleSelectUser = (user, tab) => {
    setSelectedUser(user);
    fetchFoodsForUser(user, tab);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedUser(null);
    setFoods([]);
  };

  const handleFoodAction = () => {
    fetchUsersWithPendingFoods();
    if (selectedUser) {
      fetchFoodsForUser(selectedUser, activeTab);
    }
    refreshPendingRequests();
  };

  return (
    <>
      <Helmet>
        <title>Solicitudes de Alimentos - Admin</title>
        <meta name="description" content="Gestiona los alimentos creados por los usuarios." />
      </Helmet>
      <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-2">Solicitudes de Alimentos</h1>
        <p className="text-gray-400 mb-6">Revisa, aprueba y enlaza los alimentos creados por los clientes.</p>
        
        <TabNavigation 
          tabs={TABS} 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          pendingCount={pendingFoodCount}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <UserList
            users={users}
            loading={loadingUsers}
            selectedUser={selectedUser}
            onSelectUser={(user) => handleSelectUser(user, activeTab)}
            activeTab={activeTab}
          />
          <FoodsList
            foods={foods}
            loading={loadingFoods}
            selectedUser={selectedUser}
            onFoodAction={handleFoodAction}
          />
        </div>
      </div>
    </>
  );
};

export default UserCreatedFoodsPage;