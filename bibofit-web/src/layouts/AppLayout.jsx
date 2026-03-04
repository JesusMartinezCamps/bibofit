import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import QuickStartGuideModal from '@/components/QuickStartGuideModal';
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

  const shouldRemoveMobilePadding = noMobilePaddingPaths.some(path =>
    location.pathname.startsWith(path)
  );
  const isProfileDataPage = location.pathname === '/profile/data';

  return (
    <>
      <OnboardingWizard />
      <QuickStartGuideModal />
      <Header />
      <div
        className={cn(
          'w-full flex-1 overflow-y-auto sm:px-6 app-main-shell',
          shouldRemoveMobilePadding && 'px-0 sm:px-0',
          isProfileDataPage && 'sm:px-6'
        )}
      >
        <Outlet />
      </div>
    </>
  );
};

export default AppLayout;
