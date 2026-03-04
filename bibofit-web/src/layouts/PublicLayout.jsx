import React from 'react';
import { Outlet } from 'react-router-dom';
import LandingNavbar from '@/components/landing/LandingNavbar';

const PublicLayout = () => (
  <>
    <LandingNavbar />
    <Outlet />
  </>
);

export default PublicLayout;
