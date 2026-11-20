import { ImageSquare } from "@/components/app-icons";
import { cn } from "@/lib/utils";

/**
 * Shown only in development (`npm run dev`): names the image the site owner still has to add to
 * public/assets (docs/ASSETS.md). Production builds render nothing here, only the built-in fallback.
 * Place inside a `relative` container.
 */
export function AssetHint({ file, size, compact = false, className }: { file: string; size: string; compact?: boolean; className?: string }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <span className={cn("pointer-events-none absolute z-10 flex items-start gap-1.5 rounded-md border border-dashed border-brand-500 bg-surface/95 text-ink-700 shadow-sm", compact ? "inset-x-1.5 bottom-1.5 px-1.5 py-1 text-[10.5px] leading-tight" : "bottom-3 right-3 max-w-[min(26rem,calc(100%-1.5rem))] px-2.5 py-1.5 text-[12px] leading-snug", className)}>
      <ImageSquare className={cn("shrink-0 text-brand-600", compact ? "h-3.5 w-3.5" : "mt-px h-4 w-4")} aria-hidden="true" />
      {compact
        ? <span className="min-w-0 break-all">Add <span className="font-semibold text-ink-900">assets/{file}</span></span>
        : <span className="min-w-0">Add your photo as <span className="break-all font-semibold text-ink-900">public/assets/{file}</span> ({size}). This note appears only in development.</span>}
    </span>
  );
}
