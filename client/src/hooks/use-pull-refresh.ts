import { useState, useRef, useCallback, type TouchEvent } from "react";

type UsePullRefreshOptions = {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  dampening?: number;
};

export function usePullRefresh({
  onRefresh,
  threshold = 60,
  maxPull = 80,
  dampening = 0.4,
}: UsePullRefreshOptions) {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartRef = useRef({ y: 0, scrollTop: 0, active: false });

  const onTouchStart = useCallback((e: TouchEvent) => {
    const el = e.currentTarget;
    pullStartRef.current = {
      y: e.touches[0].clientY,
      scrollTop: el.scrollTop,
      active: el.scrollTop <= 0,
    };
  }, []);

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pullStartRef.current.active || isRefreshing) return;
      const dy = e.touches[0].clientY - pullStartRef.current.y;
      if (dy > 0 && e.currentTarget.scrollTop <= 0) {
        setPullY(Math.min(dy * dampening, maxPull));
      }
    },
    [isRefreshing, dampening, maxPull],
  );

  const onTouchEnd = useCallback(() => {
    if (pullY > threshold && !isRefreshing) {
      setIsRefreshing(true);
      onRefresh().finally(() => {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullY(0);
        }, 500);
      });
    } else {
      setPullY(0);
    }
    pullStartRef.current.active = false;
  }, [pullY, threshold, isRefreshing, onRefresh]);

  return {
    pullY,
    isRefreshing,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
