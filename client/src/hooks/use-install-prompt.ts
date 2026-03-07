import { useState, useEffect, useCallback } from "react";

const COOLDOWN_KEY = "pwa-install-dismissed-at";
const COOLDOWN_DAYS = 30;
const INSTALLED_KEY = "pwa-installed";

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function isCooldownActive(): boolean {
  const dismissed = localStorage.getItem(COOLDOWN_KEY);
  if (!dismissed) return false;
  const dismissedAt = parseInt(dismissed, 10);
  if (isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < COOLDOWN_DAYS;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = isInStandaloneMode();
    setIsStandalone(standalone);
    if (standalone || localStorage.getItem(INSTALLED_KEY) === "true") {
      setShowPrompt(false);
      return;
    }

    const ios = isIos();
    setIsIosDevice(ios);

    if (isCooldownActive()) {
      setShowPrompt(false);
      return;
    }

    if (ios) {
      setShowPrompt(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      setShowPrompt(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "true");
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    setShowPrompt(false);
    setDeferredPrompt(null);
  }, []);

  return {
    showPrompt: showPrompt && !isStandalone,
    isIos: isIosDevice,
    canInstallNative: !!deferredPrompt,
    install,
    dismiss,
  };
}
