import Image from "next/image";
import Link from "next/link";
import { ASSET } from "@/lib/assets";
import { Building2, Landmark, Users } from "@/components/app-icons";
import { AdminLogoMark, TricolorRibbon } from "@/components/brand/Logo";
import { Skyline } from "@/components/brand/Skyline";
import { BuildingScene } from "@/components/site/MiniScenes";
import { AssetHint } from "@/components/site/AssetHint";
import { AdminNavLinks } from "./AdminNavLinks";
import { MobileNav } from "@/components/client/MobileNav";
import { ROLE_LABEL, type Actor } from "@/lib/authz";


export function AdminSidebar({ newComplaints }: { newComplaints: number }) {
  const sidebarImg = ASSET.adminSidebar();
  return (
    <aside className="relative flex flex-col overflow-hidden bg-gradient-to-b from-[#071d49] via-navy-800 to-[#03153a] lg:sticky lg:top-0 lg:h-screen">
      <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-0 lg:pb-6 lg:pt-4 lg:text-center">
        <Link href="/admin" className="flex items-center gap-2 lg:flex-col lg:gap-0" aria-label="Admin dashboard">
          <AdminLogoMark className="h-10 w-24 lg:h-16 lg:w-36" />
          <span className="font-display text-[20px] font-bold leading-tight text-white lg:text-[28px]">Smart Ward<br className="hidden lg:block" /> India</span>
          <span className="hidden text-[13px] text-white/85 lg:block">Every Ward Matters</span>
        </Link>
        <MobileNav label="admin menu" buttonClassName="text-white hover:bg-white/10" inlineOnDesktop={false} contentClassName="bg-navy-900/95 text-white [&_h2]:text-white"><AdminNavLinks newComplaints={newComplaints} layoutKey="admin-nav-mobile" /></MobileNav>
      </div>
      <div className="hidden lg:block"><AdminNavLinks newComplaints={newComplaints} /></div>
      <div className="relative mt-auto hidden h-[190px] overflow-hidden lg:block" aria-hidden="true">
        {sidebarImg ? <Image src={sidebarImg} alt="" fill sizes="228px" className="object-cover opacity-80" /> : <><BuildingScene className="h-full w-full opacity-80" /><AssetHint compact file="admin/sidebar-building.webp" size="456×380" className="bottom-auto top-1.5" /></>}
        <div className="absolute inset-0 bg-gradient-to-b from-navy-800 via-transparent to-[#03153a]/90" />
        <p className="absolute bottom-3 left-4 font-script text-[22px] leading-tight text-white drop-shadow">Develop a Better<br />Tomorrow Together</p>
      </div>
    </aside>
  );
}

export function AdminFooter() {
  return (
    <footer className="mt-4 border-t border-white/10 bg-[#001942]">
      <div className="grid gap-3 px-6 py-4 text-[14px] text-white sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-white/20">
        <p className="flex items-center gap-3"><Landmark className="h-8 w-8 shrink-0" aria-hidden="true" />Collaborating with Government for Better Governance</p>
        <p className="flex items-center gap-3 xl:pl-6"><Users className="h-8 w-8 shrink-0" aria-hidden="true" />Serving residents of every participating ward</p>
        <p className="flex items-center gap-3 xl:pl-6"><Building2 className="h-8 w-8 shrink-0" aria-hidden="true" />Building a Smart &amp; Developed India</p>
        <p className="flex items-center gap-3 font-script text-[19px] xl:pl-6"><TricolorRibbon className="h-9 w-20 shrink-0" />Smart Ward India — A Step Towards Viksit Bharat</p>
      </div>
      <p className="px-6 pb-3 text-[11px] text-white/60">Independent demonstration platform with synthetic data. Not affiliated with any government body.</p>
    </footer>
  );
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join(""); }

export function AdminTopBar({ actor, title, subtitle, children }: { actor: Actor; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="relative mb-4 overflow-hidden rounded-xl">
      <Skyline className="pointer-events-none absolute inset-x-0 bottom-0 h-full w-full" />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 px-2 py-2">
        <div className="mr-auto min-w-0">
          <h1 className="font-display text-[28px] font-bold leading-tight text-white sm:whitespace-nowrap md:text-[40px] 2xl:text-[44px]">{title}</h1>
          {subtitle && <p className="text-[14px] font-medium text-white/90 md:text-[17px]">{subtitle}</p>}
        </div>
        <Link href="/admin/settings?tab=profile" className="flex items-center gap-3 rounded-xl bg-[#0b2a5e]/90 px-3 py-2 ring-1 ring-white/15 hover:bg-[#123673]">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-saffron-500 font-display text-base font-bold text-white ring-2 ring-white" aria-hidden="true">{initials(actor.name)}</span>
          <span className="text-left leading-tight"><span className="block text-[15px] font-semibold text-white">{actor.name}</span><span className="block text-[12.5px] text-white/80">{ROLE_LABEL[actor.role]}</span></span>
        </Link>
      </div>
      {children && <div className="relative flex flex-wrap items-center gap-2.5 px-2 pb-2">{children}</div>}
    </div>
  );
}

export function AdminPanelTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 font-display text-lg font-semibold text-white">{children}</h2>;
}
