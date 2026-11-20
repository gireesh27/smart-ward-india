"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu } from "@/components/app-icons";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Responsive navigation: children render inline from the breakpoint up, and inside an
 * animated shadcn Sheet (slide-over) below it. Closes on navigation.
 */
export function MobileNav({ children, label = "Menu", buttonClassName = "text-navy-700", contentClassName = "", desktopClassName = "", breakpoint = "lg", inlineOnDesktop = true }: {
  children: ReactNode; label?: string; buttonClassName?: string; contentClassName?: string; desktopClassName?: string; breakpoint?: "lg" | "xl"; inlineOnDesktop?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const hideAt = breakpoint === "xl" ? "xl:hidden" : "lg:hidden";
  const showAt = breakpoint === "xl" ? "xl:block" : "lg:block";
  return (
    <>
      {inlineOnDesktop && <div className={cn("hidden", showAt, desktopClassName)}>{children}</div>}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button type="button" className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-brand-50/60", hideAt, buttonClassName)} aria-label={`Open ${label}`}>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className={contentClassName}>
          <SheetTitle className="font-display text-lg font-semibold">Navigation</SheetTitle>
          <SheetDescription className="sr-only">{label}</SheetDescription>
          <motion.div className="mobile-nav-sheet flex flex-col gap-1 overflow-y-auto" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } } }}>
            <motion.div variants={{ hidden: { opacity: 0, x: 24 }, show: { opacity: 1, x: 0 } }}>{children}</motion.div>
          </motion.div>
        </SheetContent>
      </Sheet>
    </>
  );
}
