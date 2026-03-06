import React, { useCallback, useRef } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import DietPlanPage from './DietPlanPage';
import { DietPlanRefreshContext } from '@/contexts/DietPlanContext';

const DietPlanLayout = () => {
  const { pathname } = useLocation();
  const { date, userId } = useParams();

  const basePath = userId
    ? `/plan/dieta/${userId}/${date}`
    : `/plan/dieta/${date}`;

  const isSubRoute = pathname !== basePath;

  // Holds a reference to WeeklyDietPlanner's ref object, registered by DietPlanComponent
  const plannerRefHolder = useRef(null);

  const registerPlannerRef = useCallback((ref) => {
    plannerRefHolder.current = ref;
  }, []);

  const requestRefresh = useCallback(() => {
    // plannerRefHolder.current is the useRef object from DietPlanComponent
    // .current.current is the WeeklyDietPlanner imperative handle
    plannerRefHolder.current?.current?.refreshItems();
  }, []);

  return (
    <DietPlanRefreshContext.Provider value={{ registerPlannerRef, requestRefresh }}>
      <div style={isSubRoute ? { display: 'none' } : undefined}>
        <DietPlanPage />
      </div>
      {isSubRoute && <Outlet />}
    </DietPlanRefreshContext.Provider>
  );
};

export default DietPlanLayout;
