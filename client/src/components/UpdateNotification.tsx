import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function UpdateNotification() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let prompted = false;

    function showUpdateToast() {
      if (prompted) return;
      prompted = true;
      toast({
        title: "Dostępna nowa wersja",
        description: "Kliknij Odśwież, aby zaktualizować aplikację.",
        duration: 60000,
        action: (
          <ToastAction
            altText="Odśwież"
            data-testid="button-refresh-app"
            onClick={() => window.location.reload()}
          >
            Odśwież
          </ToastAction>
        ),
      });
    }

    function handleControllerChange() {
      showUpdateToast();
    }

    function watchRegistration(registration: ServiceWorkerRegistration) {
      if (registration.waiting) {
        showUpdateToast();
        return;
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        watchRegistration(registration);
      }
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
