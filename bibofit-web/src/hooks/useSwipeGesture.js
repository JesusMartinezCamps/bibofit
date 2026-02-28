import { useState, useRef } from 'react';
import { useSwipeConfig } from '@/contexts/SwipeGestureContext';

export const useSwipeGesture = ({ onSwipeLeft, onSwipeRight, threshold = 50, verticalTolerance = 30 }) => {
  const { isSwipeEnabled } = useSwipeConfig();
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);
  
  const touchStart = useRef({ x: 0, y: 0 });
  const lastTrigger = useRef(0);

  if (!isSwipeEnabled) {
    return {
      handlers: {},
      isSwiping: false,
      swipeOffset: 0,
      swipeDirection: null
    };
  }

  const onTouchStart = (e) => {
    touchStart.current = { 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY 
    };
    setIsSwiping(true);
    setSwipeOffset(0);
    setSwipeDirection(null);
  };

  const onTouchMove = (e) => {
    if (!isSwiping) return;
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

    // Track left and right swipes
    if (diffX > 0) {
      setSwipeOffset(diffX);
      setSwipeDirection('left');
    } else {
      const rightOffset = Math.abs(diffX);
      setSwipeOffset(rightOffset);
      setSwipeDirection(rightOffset > 0 ? 'right' : null);
    }
  };

  const onTouchEnd = (e) => {
    if (!isSwiping) return;
    
    const currentX = e.changedTouches[0]?.clientX || touchStart.current.x;
    const diffX = touchStart.current.x - currentX;
    
    setIsSwiping(false);
    setSwipeOffset(0);
    setSwipeDirection(null);

    // Trigger callback if horizontal threshold is met
    if (Math.abs(diffX) > threshold) {
      const now = Date.now();
      // Debounce trigger (500ms)
      if (now - lastTrigger.current > 500) {
        lastTrigger.current = now;
        if (diffX > 0 && onSwipeLeft) {
          onSwipeLeft();
        }
        if (diffX < 0 && onSwipeRight) {
          onSwipeRight();
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
    swipeOffset,
    swipeDirection
  };
};
