/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../utils/supabase";

const AppShellContext = createContext(null);
const STORAGE_KEY = "taptime-notifications-v1";
const MAX_NOTIFICATIONS = 40;
const READ_STORAGE_KEY = "taptime-notification-read-v1";
const HIDDEN_STORAGE_KEY = "taptime-notification-hidden-v1";

function getInitialPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function getInitialStandaloneState() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function normalizeNotification(input) {
  const nowIso = new Date().toISOString();
  const fallbackId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: input?.id ?? fallbackId,
    title: String(input?.title ?? "Notification"),
    message: String(input?.message ?? ""),
    kind: String(input?.kind ?? "general"),
    createdAt: input?.createdAt ?? nowIso,
    read: Boolean(input?.read),
  };
}

async function showBrowserNotification(notification) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const title = notification.title;
  const options = {
    body: notification.message,
    icon: "/logo.png",
    badge: "/logo.png",
    data: {
      url: window.location.pathname,
    },
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return;
      }
    }

    new Notification(title, options);
  } catch {
    // Ignore notification API failures.
  }
}

export function AppShellProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeNotification).slice(0, MAX_NOTIFICATIONS);
    } catch {
      return [];
    }
  });
  const [profile, setProfile] = useState(null);
  const [readIds, setReadIds] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(READ_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [hiddenIds, setHiddenIds] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(HIDDEN_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [permission, setPermission] = useState(getInitialPermission);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(getInitialStandaloneState);
  const recentKeysRef = useRef(new Map());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(readIds));
  }, [readIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(hiddenIds));
  }, [hiddenIds]);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("auth_id, email, first_name, last_name, role")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!cancelled && !error) {
        setProfile(data ?? null);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    const handleInstalled = () => {
      setInstallPromptEvent(null);
      setIsStandalone(true);
    };

    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
    const handleDisplayModeChange = () => {
      setIsStandalone(
        mediaQuery?.matches || window.navigator.standalone === true,
      );
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    mediaQuery?.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      mediaQuery?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const addNotification = useCallback(async (input) => {
    const dedupeKey = input?.dedupeKey ? String(input.dedupeKey) : "";
    if (dedupeKey) {
      const nowMs = Date.now();
      const lastSeenAt = recentKeysRef.current.get(dedupeKey);
      if (lastSeenAt && nowMs - lastSeenAt < 5000) {
        return null;
      }
      recentKeysRef.current.set(dedupeKey, nowMs);
    }

    const nextNotification = normalizeNotification(input);
    setNotifications((current) => [nextNotification, ...current].slice(0, MAX_NOTIFICATIONS));

    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      await showBrowserNotification(nextNotification);
    }

    return nextNotification.id;
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((current) => {
      const next = new Set(current);
      for (const item of notifications) {
        next.add(String(item.id));
      }
      return Array.from(next);
    });
    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        read: true,
      })),
    );
  }, [notifications]);

  const markAsRead = useCallback((id) => {
    setReadIds((current) =>
      current.includes(String(id)) ? current : [...current, String(id)],
    );
    setNotifications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              read: true,
            }
          : item,
      ),
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setHiddenIds((current) => {
      const next = new Set(current);
      for (const item of notifications) {
        next.add(String(item.id));
      }
      return Array.from(next);
    });
    setNotifications([]);
  }, [notifications]);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const installApp = useCallback(async () => {
    if (!installPromptEvent) return false;
    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
    return choice?.outcome === "accepted";
  }, [installPromptEvent]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
      addNotification,
      clearNotifications,
      installApp,
      isInstallAvailable: Boolean(installPromptEvent) && !isStandalone,
      isStandalone,
      markAllRead,
      markAsRead,
      notificationPermission: permission,
      requestNotificationPermission,
      supportsBrowserNotifications:
        typeof window !== "undefined" && "Notification" in window,
    }),
    [
      addNotification,
      clearNotifications,
      installApp,
      installPromptEvent,
      isStandalone,
      markAllRead,
      markAsRead,
      notifications,
      permission,
      requestNotificationPermission,
    ],
  );

  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const value = useContext(AppShellContext);
  if (!value) {
    throw new Error("useAppShell must be used within an AppShellProvider.");
  }
  return value;
}
