import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { DemoNotice } from "@/components/ui";
import { ThemeToggle } from "@/components/client/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-hero flex min-h-screen flex-col items-center px-4 pb-10 pt-4 sm:pt-6">
      <div className="mb-4 flex w-full max-w-5xl justify-end"><ThemeToggle /></div>
      <Link href="/" className="mb-6 flex min-w-0 items-center gap-3" aria-label="Smart Ward India home">
        <LogoMark className="h-14 w-14" />
        <span className="font-display text-[26px] font-extrabold leading-none text-navy-700 sm:text-3xl">Smart Ward India</span>
      </Link>
      <main id="main" className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-float md:p-8">{children}</main>
      <DemoNotice className="mt-6 max-w-md text-center" />
    </div>
  );
}
