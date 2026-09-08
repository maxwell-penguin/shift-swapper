"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";

const POLL_MS = 15000;

type Notification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleClickItem(n: Notification) {
    setOpen(false);
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" });
      load();
    }
    if (n.href) router.push(n.href);
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    await load();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink-400 hover:text-ink-200"
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-500 px-1 text-micro font-semibold text-ink-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-card border border-ink-200 bg-white text-ink-900 shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-200 px-3 py-2">
            <p className="text-label font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-caption font-medium text-accent-600 hover:text-accent-700">
                Mark all read
              </button>
            )}
          </div>
          <div className="scrollbar-thin max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-label text-ink-400">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={`flex w-full items-start gap-2 border-b border-ink-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-ink-50 ${
                    n.read ? "" : "bg-accent-100/60"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${n.read ? "bg-transparent" : "bg-accent-500"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-label font-medium text-ink-900">{n.title}</span>
                    <span className="block text-caption text-ink-600">{n.body}</span>
                    <span className="mt-0.5 block text-micro text-ink-400">
                      {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
