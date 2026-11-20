"use client";
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "@/components/app-icons";
import { cn } from "@/lib/utils";

/** shadcn Sheet: a Radix dialog that slides in from an edge (used for the mobile navigation). */
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

export const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { side?: "left" | "right" }>(
  ({ className, children, side = "right", ...props }, ref) => (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-[80] bg-navy-950/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <SheetPrimitive.Content ref={ref}
        className={cn("glass-strong fixed inset-y-0 z-[81] flex w-[86vw] max-w-sm flex-col gap-4 p-5 shadow-float duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
          side === "right" ? "right-0 rounded-l-2xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right" : "left-0 rounded-r-2xl data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left", className)}
        {...props}>
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-full p-1.5 text-ink-500 transition hover:bg-muted hover:text-ink-900"><X className="h-5 w-5" /><span className="sr-only">Close menu</span></SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  ),
);
SheetContent.displayName = "SheetContent";
