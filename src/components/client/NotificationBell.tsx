"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "@/components/app-icons";

/** Unread count, refreshed every minute while the tab is visible. */
export function NotificationBell({ href, initial, className = "text-navy-700" }: { href: string; initial: number; className?: string }) {
  const [count, setCount] = useState(initial);
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try { const r = await fetch("/api/notifications?unread=1"); if (r.ok) setCount((await r.json()).data.unread); } catch { /* offline */ }
    };
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <Link href={href} className={`relative inline-flex rounded-md p-2 ${className}`} aria-label={`Notifications${count ? `, ${count} unread` : ""}`}>
      <Bell className="h-5 w-5" aria-hidden="true" />
      {count > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-alert-600 px-1 text-center text-[11px] font-bold leading-[18px] text-white">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
