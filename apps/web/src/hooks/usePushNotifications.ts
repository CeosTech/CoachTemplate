import { useCallback, useEffect, useState } from "react";

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    const isSupported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
    setSupported(isSupported);
    if (isSupported) {
      setPermission(window.Notification.permission);
      navigator.serviceWorker.getRegistration().catch(() => null);
    }
  }, []);

  const registerWorker = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const current = await navigator.serviceWorker.getRegistration();
    if (current) return current;
    return navigator.serviceWorker.register("/sw.js");
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supported) throw new Error("Notifications non supportées par ce navigateur.");
    setRegistering(true);
    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await registerWorker();
      }
      return result;
    } finally {
      setRegistering(false);
    }
  }, [supported, registerWorker]);

  return {
    supported,
    permission,
    registering,
    requestPermission
  };
}
