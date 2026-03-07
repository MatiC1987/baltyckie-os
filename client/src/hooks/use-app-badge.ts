import { useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth-token";

function isAppBadgeSupported(): boolean {
  return "setAppBadge" in navigator && "clearAppBadge" in navigator;
}

async function setAppBadge(count: number) {
  if (!isAppBadgeSupported()) return;
  try {
    if (count > 0) {
      await (navigator as any).setAppBadge(count);
    } else {
      await (navigator as any).clearAppBadge();
    }
  } catch {
  }
}

export function useAppBadge() {
  const isAuthenticated = !!getAuthToken();

  const { data: tasks } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });

  const { data: reminders } = useQuery<{
    overdueCosts: number;
    overdueSubleasePayments: number;
  }>({
    queryKey: ["/api/dashboard-reminders"],
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });

  const incompleteTasks = tasks
    ? tasks.filter((t: any) => !t.completed).length
    : 0;

  const overduePayments =
    (reminders?.overdueCosts ?? 0) + (reminders?.overdueSubleasePayments ?? 0);

  const totalBadgeCount = incompleteTasks + overduePayments;

  useEffect(() => {
    if (isAuthenticated) {
      setAppBadge(totalBadgeCount);
    }
  }, [totalBadgeCount, isAuthenticated]);

  useEffect(() => {
    return () => {
      if (isAppBadgeSupported()) {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    };
  }, []);

  const updateBadge = useCallback((count: number) => {
    setAppBadge(count);
  }, []);

  const clearBadge = useCallback(() => {
    setAppBadge(0);
  }, []);

  return {
    isSupported: isAppBadgeSupported(),
    badgeCount: totalBadgeCount,
    incompleteTasks,
    overduePayments,
    updateBadge,
    clearBadge,
  };
}
