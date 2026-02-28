import React, { createContext, useContext, useState } from 'react';

const SwipeGestureContext = createContext();

export const SwipeGestureProvider = ({ children }) => {
  // Global kill-switch for swipe gestures across the app.
  const [isSwipeEnabled, setIsSwipeEnabled] = useState(false);
  
  return (
    <SwipeGestureContext.Provider value={{ isSwipeEnabled, setIsSwipeEnabled }}>
      {children}
    </SwipeGestureContext.Provider>
  );
};

export const useSwipeConfig = () => useContext(SwipeGestureContext);
