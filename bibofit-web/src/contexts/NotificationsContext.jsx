import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeProvider';

export const NotificationsContext = createContext();

export const useNotifications = () => useContext(NotificationsContext);

export const NotificationsProvider = ({ children }) => {
    const { user } = useAuth();
    const { subscribe, unregister } = useRealtime();

    // User notifications (client side)
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Unread count from comm_messages (human messages)
    const [unreadCommCount, setUnreadCommCount] = useState(0);

    // Admin/Coach pending requests counts
    const [pendingFoodCount, setPendingFoodCount] = useState(0);
    const [pendingFreeRecipeCount, setPendingFreeRecipeCount] = useState(0);
    const [pendingDietChangeCount, setPendingDietChangeCount] = useState(0);

    const isAdminOrCoach = user?.role === 'admin' || user?.role === 'coach';

    // 1. Fetch normal user notifications
    const fetchNotifications = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('user_notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) console.error('Error fetching notifications:', error);
        else {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    };

    // 2. Fetch pending counts for admin/coach
    const fetchPendingCounts = async () => {
        if (!isAdminOrCoach) return;

        try {
            // Pending Foods
            const { count: foodCount, error: foodError } = await supabase
                .from('food')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            if (!foodError) setPendingFoodCount(foodCount || 0);

            // Pending Free Recipes
            const { count: freeRecipeCount, error: freeRecipeError } = await supabase
                .from('user_recipes')
                .select('*', { count: 'exact', head: true })
                .eq('type', 'free')
                .eq('status', 'pending');
            if (!freeRecipeError) setPendingFreeRecipeCount(freeRecipeCount || 0);

            // Pending Diet Change Requests
            const { count: dietChangeCount, error: dietChangeError } = await supabase
                .from('diet_change_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            if (!dietChangeError) setPendingDietChangeCount(dietChangeCount || 0);

        } catch (error) {
            console.error("Error fetching pending counts:", error);
        }
    };

    // 3. Fetch total unread from Communication Center (server-side aggregation)
    const fetchUnreadCommCount = async () => {
        if (!user) { setUnreadCommCount(0); return; }
        const { data, error } = await supabase.rpc('comm_get_unread_total');
        if (error) {
            console.error('Error fetching communication unread count:', error);
            return;
        }
        setUnreadCommCount(data || 0);
    };

    // Refresh function exposed to components
    const refreshPendingRequests = () => {
        fetchPendingCounts();
    };

    useEffect(() => {
        fetchNotifications();
        fetchUnreadCommCount();
        if (isAdminOrCoach) {
            fetchPendingCounts();
        }
    }, [user, isAdminOrCoach]);

    // Keep communication unread count in sync via realtime changes
    useEffect(() => {
        if (!user) return;

        const commMsgKey = `comm_unread_messages_${user.id}`;
        const commPartKey = `comm_unread_participants_${user.id}`;
        let refreshTimer = null;

        const scheduleUnreadRefresh = () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                fetchUnreadCommCount();
            }, 150);
        };

        const handleCommMessageChange = (payload) => {
            // Messages sent by myself never increase unread
            if (payload?.eventType === 'INSERT' && payload?.new?.sender_id === user.id) return;
            scheduleUnreadRefresh();
        };

        const handleCommParticipantChange = () => {
            scheduleUnreadRefresh();
        };

        subscribe(commMsgKey, {
            event: '*',
            schema: 'public',
            table: 'comm_messages',
        }, handleCommMessageChange);

        subscribe(commPartKey, {
            event: '*',
            schema: 'public',
            table: 'comm_participants',
            filter: `user_id=eq.${user.id}`,
        }, handleCommParticipantChange);

        return () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            unregister(commMsgKey, handleCommMessageChange);
            unregister(commPartKey, handleCommParticipantChange);
        };
    }, [user, subscribe, unregister]);

    // Realtime subscriptions
    useEffect(() => {
        if (!user) return;

        // Subscribe to user_notifications for everyone
        const notifKey = `user_notifications_${user.id}`;
        const handleNotification = (payload) => {
            if (payload.eventType === 'INSERT') {
                setNotifications(prev => [payload.new, ...prev]);
                setUnreadCount(prev => prev + 1);
            }
        };

        subscribe(notifKey, {
            event: 'INSERT',
            schema: 'public',
            table: 'user_notifications',
            filter: `user_id=eq.${user.id}`
        }, handleNotification);

        // Subscribe to administrative tables if admin/coach
        if (isAdminOrCoach) {
            const adminKey = `admin_pending_counts`;
            
            const handleAdminChange = () => {
                // Ideally we'd inspect payload, but simple refresh is safer/easier for counts
                fetchPendingCounts();
            };

            // Listen to changes in relevant tables
            subscribe(`${adminKey}_foods`, { event: '*', schema: 'public', table: 'food' }, handleAdminChange);
            subscribe(`${adminKey}_free_recipes`, { event: '*', schema: 'public', table: 'free_recipes' }, handleAdminChange);
            subscribe(`${adminKey}_diet_requests`, { event: '*', schema: 'public', table: 'diet_change_requests' }, handleAdminChange);

            return () => {
                unregister(notifKey, handleNotification);
                unregister(`${adminKey}_foods`, handleAdminChange);
                unregister(`${adminKey}_free_recipes`, handleAdminChange);
                unregister(`${adminKey}_diet_requests`, handleAdminChange);
            };
        }

        return () => unregister(notifKey, handleNotification);
    }, [user, isAdminOrCoach, subscribe, unregister]);

    const markAsRead = async (id) => {
        const { error } = await supabase
            .from('user_notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };
    
    const markAllAsRead = async () => {
        if (!user) return;
        const { error } = await supabase
            .from('user_notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        }
    };

    const hasPendingRequests = (pendingFoodCount > 0) || (pendingFreeRecipeCount > 0) || (pendingDietChangeCount > 0);
    const totalUnread = unreadCount + unreadCommCount;

    return (
        <NotificationsContext.Provider value={{
            notifications,
            unreadCount,
            unreadCommCount,
            totalUnread,
            markAsRead,
            markAllAsRead,
            pendingFoodCount,
            pendingFreeRecipeCount,
            pendingDietChangeCount,
            hasPendingRequests,
            refreshPendingRequests,
            refreshUnreadCommCount: fetchUnreadCommCount,
        }}>
            {children}
        </NotificationsContext.Provider>
    );
};
