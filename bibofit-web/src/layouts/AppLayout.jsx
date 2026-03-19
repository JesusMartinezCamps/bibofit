import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import ContextualGuideTooltip from '@/components/contextual-guide/ContextualGuideTooltip';
import GuideHelpCenter from '@/components/contextual-guide/GuideHelpCenter';
import { cn } from '@/lib/utils';

const noMobilePaddingPaths = [
  '/plan/dieta',
  '/create-snack',
  '/create-free-recipe',
  '/admin-panel/plan-detail',
  '/dashboard',
  '/coach-dashboard',
  '/plan',
  '/admin-panel/advisories',
  '/shopping-list',
  '/assign-diet-plan',
];

const AppLayout = () => {
  const location = useLocation();

  useEffect(() => {
    document.body.classList.add('app-shell-scroll-lock');
    return () => {
      document.body.classList.remove('app-shell-scroll-lock');
    };
  }, []);

  const shouldRemoveMobilePadding = noMobilePaddingPaths.some(path =>
    location.pathname.startsWith(path)
  );
  const isProfileDataPage = location.pathname === '/profile/data';
  const isPlanOverviewPage = location.pathname === '/plan';

  return (
    <>
      <OnboardingWizard />
      <ContextualGuideTooltip />
      <GuideHelpCenter />
      <Header />
      <div
        className={cn(
          'w-full flex-1 overflow-y-auto sm:px-6 app-main-shell',
          shouldRemoveMobilePadding && 'px-0 sm:px-0',
          isProfileDataPage && 'sm:px-6'
        )}
        style={isPlanOverviewPage ? { paddingBottom: 0 } : undefined}
      >
        <Outlet />
      </div>
    </>
  );
};

export default AppLayout;
