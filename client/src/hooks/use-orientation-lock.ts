import { useEffect } from "react";

type OrientationType = "portrait" | "landscape";

export function useOrientationLock(orientation: OrientationType) {
  useEffect(() => {
    const so = screen?.orientation as any;
    if (!so || typeof so.lock !== "function") return;

    const lockType =
      orientation === "portrait" ? "portrait-primary" : "landscape-primary";

    let locked = false;

    so.lock(lockType)
      .then(() => {
        locked = true;
      })
      .catch(() => {});

    return () => {
      if (locked && typeof so.unlock === "function") {
        so.unlock();
      }
    };
  }, [orientation]);
}
