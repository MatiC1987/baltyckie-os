import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";

export function NavigationProgress() {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const prevLocation = useRef(location);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (prevLocation.current !== location) {
      prevLocation.current = location;
      setDone(false);
      setVisible(true);

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        setDone(true);
        timerRef.current = setTimeout(() => {
          setVisible(false);
        }, 400);
      }, 300);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location]);

  if (!visible) return null;

  return (
    <div
      className={`nav-progress-bar ${done ? "done" : ""}`}
      data-testid="nav-progress-bar"
    />
  );
}
