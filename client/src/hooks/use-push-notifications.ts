import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushStatus = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed" | "error";

export function usePushNotifications(userType: string = "admin") {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    const permission = Notification.permission;
    if (permission === "denied") {
      setStatus("denied");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setStatus(subscription ? "subscribed" : "unsubscribed");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const subscribe = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/push/vapid-public-key");
      const { publicKey } = await res.json();
      if (!publicKey) {
        setError("Klucz VAPID niedostępny");
        setStatus("error");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const sub = subscription.toJSON();
      await apiRequest("POST", "/api/push/subscribe", {
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh,
        auth: sub.keys?.auth,
        userType,
      });

      setStatus("subscribed");
    } catch (err: any) {
      setError(err.message || "Błąd subskrypcji");
      setStatus("error");
    }
  }, [userType]);

  const unsubscribe = useCallback(async () => {
    try {
      setError(null);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await apiRequest("POST", "/api/push/unsubscribe", { endpoint });
      }
      setStatus("unsubscribed");
    } catch (err: any) {
      setError(err.message || "Błąd wypisania");
      setStatus("error");
    }
  }, []);

  return { status, error, subscribe, unsubscribe };
}
