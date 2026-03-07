import { useState, useEffect, useCallback } from 'react';
import { getPendingCount, replayQueue } from '@/lib/offline-queue';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (_e) {
      setPendingCount(0);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      await replayQueue();
      await refreshCount();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshCount]);

  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      syncNow();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(refreshCount, 5000);

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        refreshCount();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [refreshCount, syncNow]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    hasPending: pendingCount > 0,
    syncNow,
    refreshCount,
  };
}
