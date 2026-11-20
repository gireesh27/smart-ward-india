import Link from "next/link";
import { AtlasMap } from "@/components/client/AtlasMap";

export const metadata = { title: "Map of Andhra Pradesh", description: "Interactive map of Andhra Pradesh: districts, assembly constituencies and mandals shaded by development score. Zoom in to drill down.", alternates: { canonical: "/map" } };

export default function MapPage({ searchParams }: { searchParams: { layer?: string; district?: string } }) {
  const layer = searchParams.layer === "mandals" || searchParams.layer === "constituencies" || searchParams.layer === "districts" || searchParams.layer === "villages" ? searchParams.layer : "auto";
  return (
    <div className="mx-auto max-w-page px-2 pb-4 pt-3 sm:px-4 md:px-8">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h1 className="text-2xl font-bold text-navy-700 sm:text-3xl">Andhra Pradesh development map</h1>
          <p className="text-sm text-ink-700">Zoom in to go from districts to assembly constituencies, mandals and villages, or click an area to drill down. Use the path above the map to go back.</p>
        </div>
        <Link href="/dashboard" className="btn-outline btn-sm">Open dashboard</Link>
      </div>
      <AtlasMap variant="full" initialLayer={layer} selectedDistrictId={searchParams.district} districtHref="/dashboard?district={id}" height="calc(100dvh - 12rem)" className="min-h-[460px]" />
      <p className="mt-2 px-1 text-[11px] text-ink-500">Boundaries: district, mandal and assembly-constituency layers supplied for this project (districts rebuilt from mandals to match the 28 current LGD districts); reference outline: Survey of India via DataMeet (CC BY 4.0). Map tiles © OpenStreetMap contributors. Constituency scores are approximate. Development data outside pilot areas is synthetic demo data.</p>
    </div>
  );
}
