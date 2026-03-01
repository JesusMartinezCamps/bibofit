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
      const { data: pendingFoods, error: pendingError } = await supabase
        .from('food')
        .select('user_id')
        .eq('status', 'pending')
        .not('user_id', 'is', null);
      if (pendingError) throw pendingError;

      const countsByUser = new Map();
      (pendingFoods || []).forEach((row) => {
        const userId = row.user_id;
        if (!userId) return;
        countsByUser.set(userId, (countsByUser.get(userId) || 0) + 1);
      });

      const userIds = Array.from(countsByUser.keys());
      if (userIds.length === 0) {
        setUsers([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      if (profileError) throw profileError;

      const usersWithCount = (profiles || [])
        .map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          pending_count: countsByUser.get(p.user_id) || 0,
        }))
        .filter((u) => u.pending_count > 0)
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

      setUsers(usersWithCount);
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
        .from('food')
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
            activeTab={activeTab}
            onFoodAction={handleFoodAction}
          />
        </div>
      </div>
    </>
  );
};

export default UserCreatedFoodsPage;
