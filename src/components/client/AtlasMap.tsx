"use client";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

export type AtlasLayer = "districts" | "constituencies" | "mandals" | "villages";
export type AtlasMode = "auto" | AtlasLayer;
export type AtlasProps = {
  /** Which layers the switcher offers (default: all). */
  layers?: AtlasLayer[];
  /** "auto" (default) picks the layer from the zoom level: districts → constituencies → mandals → villages. */
  initialLayer?: AtlasMode;
  /** Database id of a district to highlight and zoom to. */
  selectedDistrictId?: string | null;
  /** Link for a district's dashboard, "{id}" is replaced by the district id. */
  districtHref?: string;
  palette?: "bands" | "blue";
  /** compact: dashboard card · standard: page section · full: whole page. */
  variant?: "compact" | "standard" | "full";
  month?: string;
  height?: number | string;
  className?: string;
};

const Inner = dynamic(() => import("./AtlasMapInner"), { ssr: false, loading: () => <div className="skeleton h-full w-full rounded-xl" aria-label="Loading map" /> });

/**
 * Interactive Andhra Pradesh map: districts, mandals and assembly constituencies from the installed
 * boundary layers, shaded by development score. Zoom buttons, pinch-zoom, pan, full screen,
 * locate, search, legend and a details panel for the selected area.
 */
export function AtlasMap({ height = 380, className, ...props }: AtlasProps) {
  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <Inner {...props} />
    </div>
  );
}
