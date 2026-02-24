
import React, { createContext, useContext, useState } from 'react';

const SwipeGestureContext = createContext();

export const SwipeGestureProvider = ({ children }) => {
  const [isSwipeEnabled, setIsSwipeEnabled] = useState(true);
  
  return (
    <SwipeGestureContext.Provider value={{ isSwipeEnabled, setIsSwipeEnabled }}>
      {children}
    </SwipeGestureContext.Provider>
  );
};

export const useSwipeConfig = () => useContext(SwipeGestureContext);
