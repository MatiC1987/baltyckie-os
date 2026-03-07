import { useRef, useCallback, useState } from "react";

interface UseSwipeActionOptions {
  threshold?: number;
  maxSwipe?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function useSwipeAction({
  threshold = 80,
  maxSwipe = 120,
  onSwipeLeft,
  onSwipeRight,
}: UseSwipeActionOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const locked = useRef(false);
  const [offsetX, setOffsetX] = useState(0);
  const [isSettling, setIsSettling] = useState(false);

  const reset = useCallback(() => {
    setIsSettling(true);
    setOffsetX(0);
    swiping.current = false;
    locked.current = false;
    setTimeout(() => setIsSettling(false), 300);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isSettling) return;
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    currentX.current = touch.clientX;
    swiping.current = false;
    locked.current = false;
  }, [isSettling]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isSettling) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    if (!locked.current) {
      if (Math.abs(dy) > Math.abs(dx)) {
        locked.current = true;
        return;
      }
      if (Math.abs(dx) > 10) {
        swiping.current = true;
        locked.current = true;
      }
    }

    if (!swiping.current) return;

    const hasLeft = !!onSwipeLeft;
    const hasRight = !!onSwipeRight;

    let clamped = dx;
    if (clamped < 0 && !hasLeft) clamped = 0;
    if (clamped > 0 && !hasRight) clamped = 0;
    clamped = Math.max(-maxSwipe, Math.min(maxSwipe, clamped));

    currentX.current = touch.clientX;
    setOffsetX(clamped);
  }, [isSettling, maxSwipe, onSwipeLeft, onSwipeRight]);

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) return;

    if (offsetX <= -threshold && onSwipeLeft) {
      onSwipeLeft();
    } else if (offsetX >= threshold && onSwipeRight) {
      onSwipeRight();
    }

    reset();
  }, [offsetX, threshold, onSwipeLeft, onSwipeRight, reset]);

  return {
    offsetX,
    isSettling,
    isSwiping: swiping.current,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    reset,
  };
}
