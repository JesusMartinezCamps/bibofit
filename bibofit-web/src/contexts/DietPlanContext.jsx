import { createContext, useContext } from 'react';

export const DietPlanRefreshContext = createContext({
  registerPlannerRef: () => {},
  requestRefresh: () => {},
});

export const useDietPlanRefresh = () => useContext(DietPlanRefreshContext);
