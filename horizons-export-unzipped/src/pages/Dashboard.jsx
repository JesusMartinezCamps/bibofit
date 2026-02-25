import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import SharedCalendar from '@/components/shared/SharedCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="h-full"
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