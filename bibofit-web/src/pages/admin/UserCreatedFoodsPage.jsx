import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import UserList from '@/components/admin/UserCreatedFoods/UserList';
import FoodsList from '@/components/admin/UserCreatedFoods/FoodsList';
import TabNavigation from '@/components/admin/UserCreatedFoods/TabNavigation';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  rebalanceImpactedFutureMealsForFood,
  removeFoodFromFutureMealsAndRebalance,
} from '@/lib/foodModerationImpactService';
import { FOOD_CARD_SELECT, normalizeFoodRecord } from '@/lib/food/foodModel';
import { useLocation } from 'react-router-dom';
import { isCoachRole } from '@/lib/roles';

const TABS = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'review', label: 'En Revisión' },
];

const UserCreatedFoodsPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [foods, setFoods] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [allSensitivities, setAllSensitivities] = useState([]);
  const [coachClientIds, setCoachClientIds] = useState([]);
  const foodCacheRef = useRef(new Map());
  const preselectedUserHandledRef = useRef(false);
  const { toast } = useToast();
  const { pendingFoodCount, refreshPendingRequests } = useNotifications();

  const isCoach = isCoachRole(user?.role);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedUserId = searchParams.get('userId');
  const requestedTab = searchParams.get('tab');

  const normalizeRequestedTab = useCallback((tabValue) => {
    if (tabValue === 'pending' || tabValue === 'approved' || tabValue === 'rejected' || tabValue === 'review') {
      return tabValue;
    }
    return null;
  }, []);

  useEffect(() => {
    const normalizedTab = normalizeRequestedTab(requestedTab);
    if (normalizedTab && normalizedTab !== activeTab) {
      setActiveTab(normalizedTab);
    }
    preselectedUserHandledRef.current = false;
  }, [requestedTab, requestedUserId, normalizeRequestedTab, activeTab]);

  const mapTabToFoodFilter = (tab) => {
    if (tab === 'review') return { moderation_status: 'needs_review' };
    if (tab === 'approved') return ['approved_general', 'approved_private'];
    return [tab];
  };

  const fetchUsersByStatus = useCallback(async (tab) => {
    setLoadingUsers(true);
    try {
      const filter = mapTabToFoodFilter(tab);
      let query = supabase.from('food').select('user_id').not('user_id', 'is', null);
      if (Array.isArray(filter)) query = query.in('status', filter);
      if (!Array.isArray(filter)) query = query.eq('moderation_status', filter.moderation_status);
      if (isCoach) {
        if (coachClientIds.length === 0) {
          setUsers([]);
          return;
        }
        query = query.in('user_id', coachClientIds);
      }

      const { data: foodsByStatus, error: foodsError } = await query;
      if (foodsError) throw foodsError;

      const countsByUser = new Map();
      (foodsByStatus || []).forEach((row) => {
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
  }, [toast, isCoach, coachClientIds]);

  const fetchFoodsForUser = useCallback(async (user, tab, options = {}) => {
    if (!user) return;
    const { force = false } = options;
    const cacheKey = `${user.user_id}:${tab}`;

    if (!force && foodCacheRef.current.has(cacheKey)) {
      setFoods(foodCacheRef.current.get(cacheKey));
      return;
    }

    setLoadingFoods(true);
    try {
      const filter = mapTabToFoodFilter(tab);
      let query = supabase.from('food').select(FOOD_CARD_SELECT).eq('user_id', user.user_id);
      if (Array.isArray(filter)) query = query.in('status', filter);
      if (!Array.isArray(filter)) query = query.eq('moderation_status', filter.moderation_status);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      const normalizedFoods = (data || []).map(normalizeFoodRecord);
      foodCacheRef.current.set(cacheKey, normalizedFoods);
      setFoods(normalizedFoods);
    } catch (error) {
      toast({ title: 'Error', description: `No se pudieron cargar los alimentos: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoadingFoods(false);
    }
  }, [toast]);

  useEffect(() => {
    const fetchCoachClients = async () => {
      if (!isCoach || !user?.id) return;
      const { data, error } = await supabase
        .from('coach_clients')
        .select('client_id')
        .eq('coach_id', user.id);
      if (error) {
        toast({
          title: 'Error',
          description: `No se pudo cargar la lista de clientes: ${error.message}`,
          variant: 'destructive',
        });
        setCoachClientIds([]);
        return;
      }
      setCoachClientIds((data || []).map((row) => row.client_id));
    };
    fetchCoachClients();
  }, [isCoach, user?.id, toast]);

  useEffect(() => {
    if (isCoach && coachClientIds.length === 0) {
      setUsers([]);
      setSelectedUser(null);
      setFoods([]);
      return;
    }
    fetchUsersByStatus(activeTab);
    setSelectedUser(null);
    setFoods([]);
    preselectedUserHandledRef.current = false;
  }, [activeTab, fetchUsersByStatus, isCoach, coachClientIds]);

  useEffect(() => {
    if (preselectedUserHandledRef.current) return;
    if (!requestedUserId || users.length === 0) return;

    const targetUser = users.find((item) => String(item.user_id) === String(requestedUserId));
    if (!targetUser) return;

    preselectedUserHandledRef.current = true;
    setSelectedUser(targetUser);
    fetchFoodsForUser(targetUser, activeTab);
  }, [users, requestedUserId, activeTab, fetchFoodsForUser]);

  useEffect(() => {
    const fetchSensitivities = async () => {
      const { data } = await supabase.from('sensitivities').select('id, name');
      setAllSensitivities(data || []);
    };
    fetchSensitivities();
  }, []);

  const handleSelectUser = (user, tab) => {
    setSelectedUser(user);
    fetchFoodsForUser(user, tab);
  };

  const handleTabChange = (tabId) => setActiveTab(tabId);

  const handleFoodAction = () => {
    foodCacheRef.current.clear();
    fetchUsersByStatus(activeTab);
    if (selectedUser) {
      fetchFoodsForUser(selectedUser, activeTab, { force: true });
    }
    refreshPendingRequests();
  };

  const showRebalanceReportToast = (report, actionLabel) => {
    if (report.summary.impactedMeals === 0) {
      toast({
        title: actionLabel,
        description: 'No había recetas futuras afectadas. No fue necesario autocuadrar.',
      });
      return;
    }

    if (report.success) {
      toast({
        title: actionLabel,
        description: `Autocuadre aplicado en ${report.summary.succeededGroups}/${report.summary.processedGroups} bloques futuros.`,
        variant: 'success',
      });
      return;
    }

    toast({
      title: `${actionLabel} con incidencias`,
      description: `Autocuadre parcial: ${report.summary.succeededGroups}/${report.summary.processedGroups}. Revisión requerida en ${report.summary.failedGroups} bloques.`,
      variant: 'destructive',
    });
  };

  const notifyUser = async ({ userId, title, message, type }) => {
    try {
      await supabase.from('user_notifications').insert({
        user_id: userId,
        title,
        message,
        type,
        is_read: false,
      });
    } catch (error) {
      console.error('No se pudo crear notificación in-app:', error);
    }
  };

  const setReviewState = async (foodId, report, baseStatusForSuccess = 'approved') => {
    const hasFailures = !report.success || report.summary.failedGroups > 0 || report.errors.length > 0;
    const nextModerationStatus = hasFailures ? 'needs_review' : baseStatusForSuccess;
    const reason = hasFailures
      ? `Pendiente revisión: ${report.summary.failedGroups} bloque(s) con error.`
      : null;
    await supabase
      .from('food')
      .update({ moderation_status: nextModerationStatus, rejection_reason: reason })
      .eq('id', foodId);
    return hasFailures;
  };

  const handleImport = async (food, type) => {
    const targetStatus = type === 'general' ? 'approved_general' : 'approved_private';
    const targetVisibility = type === 'general' ? 'global' : 'private';

    try {
      const { data: authData } = await supabase.auth.getUser();
      const moderatorId = authData?.user?.id || null;

      const { error } = await supabase
        .from('food')
        .update({
          status: targetStatus,
          visibility: targetVisibility,
          moderation_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: moderatorId,
          rejected_at: null,
          rejection_reason: null,
        })
        .eq('id', food.id);
      if (error) throw error;

      const report = await rebalanceImpactedFutureMealsForFood({
        foodId: food.id,
        userId: food.user_id,
      });
      const needsReview = await setReviewState(food.id, report, 'approved');

      await notifyUser({
        userId: food.user_id,
        title: 'Solicitud de alimento revisada',
        message: needsReview
          ? `Tu alimento "${food.name}" fue aprobado (${type === 'general' ? 'general' : 'privado'}) pero quedó en revisión por recálculo parcial.`
          : `Tu alimento "${food.name}" fue aprobado (${type === 'general' ? 'general' : 'privado'}) y ya está disponible.`,
        type: 'food_request_status',
      });

      showRebalanceReportToast(report, 'Alimento aprobado');
      handleFoodAction();
    } catch (error) {
      toast({
        title: 'Error',
        description: `No se pudo aprobar el alimento: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (foodId) => {
    const food = foods.find((f) => f.id === foodId);
    if (!food) return;

    try {
      const { error } = await supabase
        .from('food')
        .update({
          status: 'rejected',
          moderation_status: 'rejected',
          rejected_at: new Date().toISOString(),
        })
        .eq('id', foodId);
      if (error) throw error;

      const report = await removeFoodFromFutureMealsAndRebalance({
        foodId,
        userId: food.user_id,
      });
      const needsReview = await setReviewState(food.id, report, 'rejected');

      await notifyUser({
        userId: food.user_id,
        title: 'Solicitud de alimento rechazada',
        message: needsReview
          ? `Tu alimento "${food.name}" fue rechazado. Se inició reparación de recetas futuras, pero quedó revisión pendiente.`
          : `Tu alimento "${food.name}" fue rechazado y se retiró de recetas futuras.`,
        type: 'food_request_status',
      });

      showRebalanceReportToast(report, 'Alimento rechazado');
      handleFoodAction();
    } catch (error) {
      toast({
        title: 'Error',
        description: `No se pudo rechazar el alimento: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (foodId) => {
    try {
      const { error } = await supabase.rpc('delete_food_with_dependencies', { p_food_id: foodId });
      if (error) throw error;
      toast({ title: 'Éxito', description: 'Alimento eliminado permanentemente.', variant: 'success' });
      handleFoodAction();
    } catch (error) {
      toast({
        title: 'Error',
        description: `No se pudo eliminar el alimento: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Solicitudes de Alimentos - Gestión</title>
        <meta name="description" content="Gestiona los alimentos creados por los usuarios." />
      </Helmet>
      <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-2">Solicitudes de Alimentos</h1>
        <p className="text-muted-foreground mb-6">
          Revisa, aprueba o rechaza alimentos. Si un recálculo falla, el alimento queda en cola "En Revisión".
        </p>
        
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
            onImport={handleImport}
            onReject={handleReject}
            onDelete={handleDelete}
            allSensitivities={allSensitivities}
            onActionComplete={handleFoodAction}
          />
        </div>
      </div>
    </>
  );
};

export default UserCreatedFoodsPage;
