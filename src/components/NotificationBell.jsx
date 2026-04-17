import { Bell, BellRing, CheckCheck, Download, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppShell } from "../context/AppShellContext";

function formatTimestamp(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationBell() {
  const {
    clearNotifications,
    installApp,
    isInstallAvailable,
    markAllRead,
    markAsRead,
    notificationPermission,
    notifications,
    requestNotificationPermission,
    supportsBrowserNotifications,
    unreadCount,
  } = useAppShell();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  const canRequestPermission =
    supportsBrowserNotifications && notificationPermission !== "granted";

  const permissionLabel = useMemo(() => {
    if (!supportsBrowserNotifications) return "Browser notifications unavailable";
    if (notificationPermission === "granted") return "Browser notifications enabled";
    if (notificationPermission === "denied") return "Browser notifications blocked";
    return "Enable browser notifications";
  }, [notificationPermission, supportsBrowserNotifications]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 cursor-pointer"
        aria-label="Open notifications"
      >
        {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-orange-500 px-1.5 py-0.5 text-center text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-[-4.5rem] md:right-0 top-12 z-50 w-[calc(100vw-2rem)] sm:w-80 md:w-[22rem] bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
          <div className="flex flex-col max-h-[80vh] md:max-h-96">
            <div className="border-b border-gray-100 px-4 py-3 shrink-0 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-800">Notifications</p>
                  <p className="text-[11px] font-medium text-gray-500">
                    Live updates from your attendance system
                  </p>
                </div>
                <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-600">
                  {unreadCount} unread
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {canRequestPermission && (
                  <button
                    type="button"
                    onClick={() => requestNotificationPermission()}
                    className="inline-flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-[11px] font-bold text-orange-600 hover:bg-orange-100 cursor-pointer"
                  >
                    <Smartphone size={14} />
                    {permissionLabel}
                  </button>
                )}
                {isInstallAvailable && (
                  <button
                    type="button"
                    onClick={() => installApp()}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <Download size={14} />
                    Install App
                  </button>
                )}
                {notifications.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      <CheckCheck size={14} />
                      Mark All Read
                    </button>
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      <Trash2 size={14} />
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-sm font-medium text-gray-500">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => markAsRead(item.id)}
                    className={`block w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 cursor-pointer ${
                      item.read ? "bg-white" : "bg-orange-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800">{item.title}</p>
                        <p className="mt-1 text-xs font-medium leading-5 text-gray-500">
                          {item.message}
                        </p>
                      </div>
                      {!item.read && (
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" />
                      )}
                    </div>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {formatTimestamp(item.createdAt)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
