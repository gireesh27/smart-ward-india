import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCitizenArea } from "@/lib/session";
import { LogoMark } from "@/components/brand/Logo";
import { MobileNav } from "@/components/client/MobileNav";
import { NotificationBell } from "@/components/client/NotificationBell";
import { SignOutButton } from "@/components/client/SignOutButton";
import { NavLink } from "@/components/site/NavLink";
import { PublicFooter } from "@/components/site/PublicFooter";
import { getSiteContent } from "@/lib/settings";

const NAV = [
  { href: "/portal", label: "Dashboard", exact: true },
  { href: "/portal/report", label: "Report an issue" },
  { href: "/portal/complaints", label: "My complaints" },
  { href: "/portal/ward", label: "My ward" },
  { href: "/portal/projects", label: "Projects" },
  { href: "/portal/profile", label: "Profile" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireCitizenArea("/portal");
  const [unread, content] = await Promise.all([prisma.notification.count({ where: { userId: actor.id, readAt: null } }), getSiteContent()]);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="relative mx-auto flex max-w-page items-center gap-3 px-4 py-2 md:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="Smart Ward India home"><LogoMark className="h-11 w-11" /><span className="font-display text-xl font-extrabold text-navy-700">Smart Ward India</span></Link>
          <div className="ml-auto flex items-center gap-2 xl:order-last"><NotificationBell href="/portal/notifications" initial={unread} /></div>
          <MobileNav breakpoint="xl" label="portal menu" desktopClassName="xl:ml-4">
            <nav aria-label="Citizen portal" className="flex flex-col gap-1 p-3 xl:flex-row xl:items-center xl:p-0">
              {NAV.map((n) => <NavLink key={n.href} href={n.href} exact={n.exact} className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-900 hover:text-brand-600" activeClassName="bg-brand-600 text-white hover:text-white">{n.label}</NavLink>)}
              {actor.isAdmin && <Link href="/admin" className="rounded-full px-3 py-1.5 text-sm font-semibold text-saffron-600">Admin dashboard</Link>}
              <SignOutButton className="btn-ghost btn-sm justify-start" />
            </nav>
          </MobileNav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-page flex-1 px-4 py-6 md:px-8">{children}</main>
      <PublicFooter content={content} />
    </div>
  );
}
