"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Gauge, Handshake, Home, Info, LayoutGrid, LogIn, Mail } from "@/components/app-icons";
import { LogoMark } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/client/ThemeToggle";
import { MobileNav } from "@/components/client/MobileNav";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/about", label: "About", icon: Info },
  { href: "/features", label: "Features", icon: LayoutGrid },
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/partners", label: "Partners", icon: Handshake },
  { href: "/contact", label: "Contact", icon: Mail },
];

/**
 * Site header, laid out as in the reference design: brand on the left, the tagline after a divider on
 * wide screens, navigation and the sign-in button on the right. A three-column grid (72 px tall on
 * desktop, 56 px on phones) with min-w-0/truncate on text, so nothing can overlap at any width.
 * Signed-in users change the theme in profile settings, so the toggle shows only for visitors.
 */
export function FloatingNav({ subtitle, taglineOne, taglineTwo, actor, logoSrc }: { subtitle: string; taglineOne: string; taglineTwo: string; actor: { name: string; isAdmin: boolean } | null; logoSrc?: string | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const cta = actor ? { href: actor.isAdmin ? "/admin" : "/portal", label: actor.isAdmin ? "Admin" : "My portal", icon: Building2 } : { href: "/login", label: "Login", icon: LogIn };

  const links = (
    <nav aria-label="Main" className="flex flex-col gap-1 xl:flex-row xl:items-center xl:gap-0.5">
      {NAV.map((n) => {
        const on = isActive(n.href, n.exact);
        return (
          <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}
            className={cn("relative inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors duration-150 xl:h-9 xl:px-3.5 xl:text-[14.5px]",
              on ? "text-white" : "text-ink-900 hover:bg-brand-50 hover:text-brand-700")}>
            {on && <motion.span layoutId="nav-active" className="absolute inset-0 -z-10 rounded-full bg-brand-600" transition={{ type: "spring", stiffness: 520, damping: 42 }} />}
            <n.icon className={cn("h-[18px] w-[18px] shrink-0", !n.exact && "xl:hidden")} aria-hidden="true" />{n.label}
          </Link>
        );
      })}
      <Link href={cta.href} className="btn-primary mt-3 h-11 xl:ml-3 xl:mt-0 xl:h-9 xl:px-5">
        <cta.icon className="h-[18px] w-[18px]" aria-hidden="true" />{cta.label}
      </Link>
      {!actor && <div className="mt-4 flex items-center justify-between border-t border-line pt-4 xl:hidden"><span className="text-sm text-ink-700">Theme</span><ThemeToggle /></div>}
    </nav>
  );

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-surface transition-shadow duration-200", scrolled ? "border-line shadow-[0_2px_12px_-6px_rgb(var(--shadow)/0.35)]" : "border-line/70")}>
      <div className="mx-auto grid h-14 max-w-page grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 md:px-8 lg:h-[72px] 2xl:h-[88px] 2xl:grid-cols-[auto_minmax(0,1fr)_auto] 2xl:gap-6">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Smart Ward India home">
          {logoSrc ? <Image src={logoSrc} alt="" width={60} height={60} className="h-10 w-10 shrink-0 object-contain lg:h-12 lg:w-12 2xl:h-[60px] 2xl:w-[60px]" priority /> : <LogoMark className="h-10 w-10 shrink-0 lg:h-12 lg:w-12 2xl:h-[60px] 2xl:w-[60px]" />}
          <span className="min-w-0">
            <span className="block truncate font-display text-[20px] font-bold leading-tight text-navy-700 lg:text-[24px] 2xl:text-[32px]">Smart Ward India</span>
            <span className="hidden truncate text-[12.5px] italic leading-tight text-ink-700 sm:block 2xl:text-[13.5px]">{subtitle}</span>
          </span>
        </Link>
        <div className="hidden min-w-0 items-center gap-4 2xl:flex">
          <span className="h-10 w-px shrink-0 bg-line-strong" aria-hidden="true" />
          <p className="min-w-0 font-display text-[14px] font-semibold italic leading-snug text-navy-700 2xl:text-[15px]"><span className="block truncate">{taglineOne}</span><span className="block truncate">{taglineTwo}</span></p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <MobileNav breakpoint="xl" label="main menu">{links}</MobileNav>
          {!actor && <div className="hidden xl:block"><ThemeToggle /></div>}
        </div>
      </div>
    </header>
  );
}
