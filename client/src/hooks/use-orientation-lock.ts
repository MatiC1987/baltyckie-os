import { useEffect } from "react";

type OrientationType = "portrait" | "landscape";

export function useOrientationLock(orientation: OrientationType) {
  useEffect(() => {
    const screenOrientation = screen?.orientation;
    if (!screenOrientation || !screenOrientation.lock) return;

    const lockType: OrientationLockType =
      orientation === "portrait" ? "portrait-primary" : "landscape-primary";

    let locked = false;

    screenOrientation
      .lock(lockType)
      .then(() => {
        locked = true;
      })
      .catch(() => {});

    return () => {
      if (locked) {
        screenOrientation.unlock();
      }
    };
  }, [orientation]);
}
