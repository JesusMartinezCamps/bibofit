import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import DietPlanComponent from '@/components/plans/DietPlanComponent';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const NotificationPopup = ({ notification, onClose }) => {
  if (!notification) return null;

  const isSaved = notification.type === 'free_meal_saved';
  const isApproved = notification.type === 'diet_change_status' && notification.message.includes('Aceptada');
  
  const isPositive = isSaved || isApproved;

  const iconClass = isPositive ? "text-green-500" : "text-blue-400";
  const buttonClass = isPositive ? "bg-green-600 hover:bg-green-700" : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700";

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            {isPositive ? <CheckCircle className={iconClass} /> : <div className="p-1 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500"><Info className="text-slate-900" size={20}/></div>}
            {notification.title}
          </DialogTitle>
          <DialogDescription className="pt-2 text-gray-300 text-base">
            {notification.message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose} className={cn(buttonClass, "text-white")}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DietPlanPage = () => {
  const { user } = useAuth();
  const [notification, setNotification] = useState(null);

  const fetchAndShowNotification = useCallback(async () => {
    if (!user) return;

    // Fetch the oldest unread notification
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching notification:", error);
      return;
    }

    if (data) {
      setNotification(data);
    }
  }, [user]);

  useEffect(() => {
    fetchAndShowNotification();
  }, [fetchAndShowNotification]);

  const handleCloseNotification = async () => {
    if (!notification) return;

    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', notification.id);

    if (error) {
      console.error("Error marking notification as read:", error);
    }
    
    setNotification(null);
    fetchAndShowNotification();
  };

  return (
    <>
      <Helmet>
        <title>Plan de Dieta - Gsus Martz</title>
        <meta name="description" content="Visualiza y gestiona tu plan de dieta diario y semanal." />
      </Helmet>
      <main className="w-full pt-0 sm:pt-8 pb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <DietPlanComponent />
        </motion.div>
      </main>
      <NotificationPopup notification={notification} onClose={handleCloseNotification} />
    </>
  );
};

export default DietPlanPage;