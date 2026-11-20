import Link from "next/link";
import { Globe, Mail, MapPin } from "@/components/app-icons";
import { TricolorRibbon } from "@/components/brand/Logo";
import type { SiteContent } from "@/lib/settings";

export function PublicFooter({ content }: { content: SiteContent }) {
  return (
    <footer className="bg-navy-900 text-white dark:bg-[#04112b]">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 text-[14px] md:px-8 xl:py-3">
        <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />{content.location}</p>
        <a href={`mailto:${content.contactEmail}`} className="flex items-center gap-2 hover:underline"><Mail className="h-4 w-4 shrink-0" aria-hidden="true" />{content.contactEmail}</a>
        <p className="flex items-center gap-2"><Globe className="h-4 w-4 shrink-0" aria-hidden="true" />{content.website}</p>
        <p className="flex items-center gap-3 font-display text-[15px] font-semibold italic lg:ml-auto">{content.footerSlogan}<TricolorRibbon className="hidden h-9 w-20 shrink-0 sm:block" /></p>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-page flex-wrap gap-x-5 gap-y-1 px-4 py-2 text-[12px] text-white/75 md:px-8">
          <span>Independent demonstration platform — not an official government service.</span>
          <Link href="/privacy" className="hover:underline">Privacy policy</Link>
          <Link href="/terms" className="hover:underline">Terms of use</Link>
          <Link href="/contact" className="hover:underline">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
