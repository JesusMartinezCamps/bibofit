
import { useState, useRef } from 'react';
import { useSwipeConfig } from '@/contexts/SwipeGestureContext';

export const useSwipeGesture = ({ onSwipeLeft, threshold = 50, verticalTolerance = 30 }) => {
  const { isSwipeEnabled } = useSwipeConfig();
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const touchStart = useRef({ x: 0, y: 0 });
  const lastTrigger = useRef(0);

  const onTouchStart = (e) => {
    if (!isSwipeEnabled) return;
    touchStart.current = { 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY 
    };
    setIsSwiping(true);
    setSwipeOffset(0);
  };

  const onTouchMove = (e) => {
    if (!isSwipeEnabled || !isSwiping) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    
    const diffX = touchStart.current.x - currentX; // Positive if swiping left
    const diffY = Math.abs(touchStart.current.y - currentY);

    // Cancel swipe if vertical movement exceeds tolerance
    if (diffY > verticalTolerance) {
      setIsSwiping(false);
      setSwipeOffset(0);
      return;
    }

    // Only track left swipes
    if (diffX > 0) {
      setSwipeOffset(diffX);
    } else {
      setSwipeOffset(0);
    }
  };

  const onTouchEnd = (e) => {
    if (!isSwipeEnabled || !isSwiping) return;
    
    const currentX = e.changedTouches[0]?.clientX || touchStart.current.x;
    const diffX = touchStart.current.x - currentX;
    
    setIsSwiping(false);
    setSwipeOffset(0);

    // Trigger callback if horizontal threshold is met
    if (diffX > threshold) {
      const now = Date.now();
      // Debounce trigger (500ms)
      if (now - lastTrigger.current > 500) {
        lastTrigger.current = now;
        if (onSwipeLeft) {
          onSwipeLeft();
        }
      }
    }
  };

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd
    },
    isSwiping,
    swipeOffset
  };
};
