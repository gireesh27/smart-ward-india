import {
  Droplet, Construction, Waves, Trash2, Zap, Lamp, Hospital, HelpCircle, Gauge, GraduationCap, Briefcase, Sprout, Leaf, type LucideIcon,
} from "@/components/app-icons";

/** Category / indicator icon names stored in the database map to these components. */
export const ICONS: Record<string, LucideIcon> = {
  water: Droplet, droplet: Droplet,
  roads: Construction, road: Construction,
  drainage: Waves,
  garbage: Trash2, sanitation: Trash2,
  electricity: Zap,
  streetlight: Lamp, streetlights: Lamp,
  healthcare: Hospital, health: Hospital,
  education: GraduationCap,
  employment: Briefcase,
  agriculture: Sprout,
  environment: Leaf,
  other: HelpCircle,
  gauge: Gauge,
};

export function CategoryIcon({ name, className = "h-5 w-5", color }: { name: string; className?: string; color?: string }) {
  const Icon = ICONS[name] ?? HelpCircle;
  return <Icon className={className} style={color ? { color } : undefined} aria-hidden="true" />;
}

/** Pastel tile + icon colours from the landing reference. */
export const TILE_STYLE: Record<string, { bg: string; fg: string }> = {
  water: { bg: "bg-tile-water", fg: "#108efc" },
  roads: { bg: "bg-tile-roads", fg: "rgb(var(--ink-700))" },
  drainage: { bg: "bg-tile-drainage", fg: "rgb(var(--ink-700))" },
  garbage: { bg: "bg-tile-garbage", fg: "#12893b" },
  electricity: { bg: "bg-tile-electricity", fg: "#ffa918" },
  streetlight: { bg: "bg-tile-streetlight", fg: "#ea7c0c" },
  healthcare: { bg: "bg-alert-100", fg: "#de0d22" },
  education: { bg: "bg-brand-100", fg: "#7a45e4" },
  employment: { bg: "bg-amber-100", fg: "#ea7c0c" },
  agriculture: { bg: "bg-leaf-100", fg: "#22a04b" },
  environment: { bg: "bg-tile-garbage", fg: "#12893b" },
  other: { bg: "bg-muted", fg: "rgb(var(--ink-500))" },
};
