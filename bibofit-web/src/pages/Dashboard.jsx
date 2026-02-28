import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import SharedCalendar from '@/components/shared/SharedCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import SwipeIndicator from '@/components/shared/SwipeIndicator';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const todayPath = `/plan/dieta/${format(new Date(), 'yyyy-MM-dd')}`;
  const trainingPath = '/plan/entreno';

  const { handlers: swipeHandlers, isSwiping, swipeOffset, swipeDirection } = useSwipeGesture({
    onSwipeLeft: () => {
      toast({
        title: 'Abriendo plan',
        description: 'Plan de dieta de hoy',
        duration: 1200
      });
      navigate(todayPath);
    },
    onSwipeRight: () => {
      toast({
        title: 'Abriendo plan',
        description: 'Plan de entreno',
        duration: 1200
      });
      navigate(trainingPath);
    }
  });

  useEffect(() => {
    const checkUserStatus = async () => {
      if (!user) return;

      try {
        // 1. Check active plans
        const { data: activePlans, error: plansError } = await supabase
          .from('diet_plans')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('is_template', false);

        if (plansError) throw plansError;

        // 2. Check profile status
        // UPDATED: Removed tour_completed_at from select as we now use onboarding_completed_at exclusively
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('onboarding_completed_at')
          .eq('user_id', user.id)
          .single();

        if (profileError) throw profileError;

        const hasActivePlans = activePlans && activePlans.length > 0;
        const onboardingCompleted = !!profile?.onboarding_completed_at;

        // Redirect logic:
        // If onboarding is marked as complete but the user has no active plan,
        // redirect them to the diet assignment page (Step 2 of the flow).
        // Note: If onboarding is NOT complete, the global OnboardingWizard in App.jsx
        // will automatically overlay and guide the user, so no explicit redirect is needed here.
        if (onboardingCompleted && !hasActivePlans) {
            navigate('/assign-diet-plan');
        }
      } catch (error) {
        console.error("Error checking user status in Dashboard:", error);
      }
    };

    checkUserStatus();
  }, [user, navigate]);

  return (
    <>
      <Helmet>
        <title>Dashboard - Bibofit</title>
        <meta name="description" content="Tu calendario de entrenamientos y dietas." />
      </Helmet>
      <main className="w-full px-0 py-8">
        <SwipeIndicator isSwiping={isSwiping && swipeDirection === 'left'} offset={swipeOffset} variant="diet-edge" />
        <SwipeIndicator isSwiping={isSwiping && swipeDirection === 'right'} offset={swipeOffset} variant="training-edge" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="h-full touch-pan-y"
          {...swipeHandlers}
        >
          <div className="h-full flex flex-col">
            <div className="flex-grow">
              {/* Force userId to ensure personal calendar renders correctly */}
              {user && <SharedCalendar userId={user.id} />}
            </div>
          </div>
        </motion.div>
      </main>
    </>
  );
};

export default Dashboard;
