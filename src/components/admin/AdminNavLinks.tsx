"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, Briefcase, FileText, Landmark, LayoutDashboard, Lightbulb, Settings, Users } from "@/components/app-icons";
import { SignOutButton } from "@/components/client/SignOutButton";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/analytics", label: "Ward Analytics", icon: BarChart3 },
  { href: "/admin/complaints", label: "Citizen Complaints", icon: Users, badge: true },
  { href: "/admin/projects", label: "Development Projects", icon: Briefcase },
  { href: "/admin/insights", label: "Insights & AI", icon: Lightbulb },
  { href: "/admin/reports", label: "Reports & Analytics", icon: FileText },
  { href: "/admin/tools", label: "Government Tools", icon: Landmark },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/** Sidebar links; the solid active marker slides to the item you open. */
export function AdminNavLinks({ newComplaints, layoutKey = "admin-nav" }: { newComplaints: number; layoutKey?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex flex-col gap-1 px-3 pb-3">
      {NAV.map((n) => {
        const on = n.exact ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}
            className={cn("group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14.5px] font-medium transition-colors", on ? "text-white" : "text-white/85 hover:bg-white/[0.07] hover:text-white")}>
            {on && <motion.span layoutId={layoutKey} className="absolute inset-0 -z-10 rounded-xl bg-brand-600" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
            <n.icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span className="flex-1">{n.label}</span>
            {n.badge && newComplaints > 0 && <span className="rounded-md bg-alert-600 px-1.5 text-[12px] font-bold" aria-label={`${newComplaints} new`}>{newComplaints}</span>}
          </Link>
        );
      })}
      <SignOutButton className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[14.5px] font-medium text-white/85 hover:bg-white/[0.07]" />
    </nav>
  );
}
