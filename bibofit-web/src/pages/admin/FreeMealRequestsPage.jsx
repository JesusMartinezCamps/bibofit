import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import UserList from '@/components/admin/UserCreatedFoods/UserList';
import FreeMealList from '@/components/admin/FreeMealRequests/FreeMealList';
import TabNavigation from '@/components/admin/UserCreatedFoods/TabNavigation';
import { useNotifications } from '@/contexts/NotificationsContext';

const TABS = [
  { id: 'pending', name: 'Pendientes' },
  { id: 'approved_private', name: 'Aprobadas (Privada)' },
  { id: 'approved_general', name: 'Aprobadas (Plantilla)' },
  { id: 'kept_as_free_recipe', name: 'Guardadas (Libre)' },
  { id: 'rejected', name: 'Rechazadas' },
];

const FreeMealRequestsPage = () => {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [freeRecipes, setFreeRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const { toast } = useToast();
  
  // Destructure notifications context safely
  const notificationContext = useNotifications();
  const pendingFreeRecipeCount = notificationContext?.pendingFreeRecipeCount || 0;
  const refreshPendingRequests = notificationContext?.refreshPendingRequests;

  const fetchUsers = useCallback(async (tab) => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.rpc('get_users_with_free_recipes_by_status', { p_status: tab });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      toast({ title: 'Error', description: `No se pudieron cargar los usuarios: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoadingUsers(false);
    }
  }, [toast]);

  const fetchRecipesForUser = useCallback(async (user, tab) => {
    if (!user) return;
    setLoadingRecipes(true);
    try {
      const { data, error } = await supabase
        .from('free_recipes')
        .select('*, day_meal:day_meals(name), ingredients:free_recipe_ingredients(*, food:food(*))')
        .eq('user_id', user.user_id)
        .eq('status', tab)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const formattedData = data.map(recipe => ({
        ...recipe,
        ingredients: recipe.ingredients.map(ing => ({
          ...ing,
          food_name: ing.food?.name,
          food_unit: ing.food?.food_unit,
          food_id: ing.food_id,
          is_user_created: !!ing.food?.user_id,
          grams: ing.grams
        }))
      }));
      setFreeRecipes(formattedData);

    } catch (error) {
      toast({ title: 'Error', description: `No se pudieron cargar las recetas: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoadingRecipes(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers(activeTab);
    setSelectedUser(null);
    setFreeRecipes([]);
  }, [activeTab, fetchUsers]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    fetchRecipesForUser(user, activeTab);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  // 1) Create a handleRefresh function that properly updates both users and pending free recipes
  const handleRefresh = async () => {
    console.log("Refreshing data...");
    // Refresh user list for current tab
    await fetchUsers(activeTab);
    
    // Refresh recipes if a user is selected
    if (selectedUser) {
        await fetchRecipesForUser(selectedUser, activeTab);
    }

    // Refresh notification counts
    if (typeof refreshPendingRequests === 'function') {
        refreshPendingRequests();
    } else {
        console.warn("refreshPendingRequests function is not available in NotificationsContext");
    }
  };

  return (
    <>
      <Helmet>
        <title>Solicitudes de Recetas Libres - Admin</title>
        <meta name="description" content="Gestiona las recetas libres creadas por los usuarios." />
      </Helmet>
      <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-2">Solicitudes de Recetas Libres</h1>
        <p className="text-gray-400 mb-6">Revisa, aprueba o rechaza las recetas libres creadas por los clientes.</p>
        
        <TabNavigation 
          tabs={TABS} 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          pendingCount={pendingFreeRecipeCount}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <UserList
            users={users}
            loading={loadingUsers}
            selectedUser={selectedUser}
            onSelectUser={handleSelectUser}
            activeTab={activeTab}
          />
          <div className="md:col-span-2">
            <FreeMealList
              freeRecipes={freeRecipes}
              loadingRecipes={loadingRecipes}
              selectedUser={selectedUser}
              activeTab={activeTab}
              onActionComplete={handleRefresh}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default FreeMealRequestsPage;
