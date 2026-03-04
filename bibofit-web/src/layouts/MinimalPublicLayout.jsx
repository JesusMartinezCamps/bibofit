import React from 'react';
import { Outlet } from 'react-router-dom';
import LandingNavbar from '@/components/landing/LandingNavbar';

const MinimalPublicLayout = () => (
  <div className="min-h-screen bg-background">
    <LandingNavbar showNavigationOptions={false} />
    <Outlet />
  </div>
);

export default MinimalPublicLayout;
