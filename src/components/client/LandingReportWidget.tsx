"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Camera } from "@/components/app-icons";
import type { GeoPath } from "@/lib/geo-types";
import { CategoryIcon, TILE_STYLE } from "@/components/icons";
import { GeoPicker } from "./GeoPicker";
import { mergeDraftFields } from "./draft";

/** Landing-page "Report a Problem" card: picks location + category, then continues in the full form. */
export function LandingReportWidget({ categories, defaultPath }: { categories: Array<{ id: string; slug: string; name: string }>; defaultPath?: GeoPath }) {
  const router = useRouter();
  const [geo, setGeo] = useState<GeoPath>(defaultPath ?? {});
  const [cat, setCat] = useState<string>("");
  const tiles = categories.filter((c) => ["water", "roads", "drainage", "garbage", "electricity", "streetlight"].includes(c.slug));

  async function go() {
    await mergeDraftFields({ geo, wardId: geo.ward?.id, categoryId: cat || undefined });
    router.push("/report");
  }

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-[14px] text-ink-900">Select your location and report an issue</p>
      <GeoPicker value={geo} onChange={setGeo} variant="compact" idPrefix="landing" showLabels={false} />
      <div role="radiogroup" aria-label="Problem category" className="mt-2.5 grid grid-cols-3 gap-2">
        {tiles.map((c) => {
          const st = TILE_STYLE[c.slug];
          const on = cat === c.id;
          return (
            <motion.button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setCat(on ? "" : c.id)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
              className={`flex h-[46px] flex-col items-center justify-center rounded-md text-[12.5px] text-ink-900 ${st.bg} ${on ? "outline outline-2 outline-brand-600" : ""}`}>
              <CategoryIcon name={c.slug} className="h-[18px] w-[18px]" color={st.fg} />{c.name}
            </motion.button>
          );
        })}
      </div>
      <button type="button" onClick={go} className="btn-navy mt-auto w-full rounded-md bg-brand-600 py-2 text-[14px] hover:bg-brand-700">
        <Camera className="h-4 w-4" aria-hidden="true" />Upload Photo &amp; Submit
      </button>
    </div>
  );
}
