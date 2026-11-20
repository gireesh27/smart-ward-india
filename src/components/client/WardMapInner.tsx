"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "./WardMap";

const TILE = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "&copy; OpenStreetMap contributors";
const color = (band: string) => (band === "Excellent" ? "#12893b" : band === "Good" ? "#41c03b" : band === "Needs Attention" ? "#fe9a22" : band === "Critical" ? "#de0d22" : "#8a96ad");

/** Re-frames the map whenever the set of points changes (e.g. after a dashboard filter). */
function FitToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const signature = points.map((p) => `${p.id}:${p.lat}:${p.lng}`).join("|");
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(points.map((p) => [p.lat, p.lng]) as LatLngBoundsExpression, { padding: [28, 28], maxZoom: 14 });
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

/** Leaflet needs to be told when its box changes size (grid reflow, mobile rotation), or tiles render half-grey. */
export function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function WardMapInner({ points }: { points: MapPoint[] }) {
  const router = useRouter();
  const [tilesFailed, setTilesFailed] = useState(false);
  return (
    <div className="relative isolate h-full w-full overflow-hidden rounded-md">
      <MapContainer center={[16.4, 80.8]} zoom={8} scrollWheelZoom={false} className="leaflet-tiles-muted h-full w-full">
        <TileLayer url={TILE} attribution={ATTR} eventHandlers={{ tileerror: () => setTilesFailed(true), tileload: () => setTilesFailed(false) }} />
        <FitToPoints points={points} />
        <AutoResize />
        {points.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={9} pathOptions={{ color: "#ffffff", weight: 2, fillColor: color(p.band), fillOpacity: 0.95 }} eventHandlers={p.href ? { click: () => router.push(p.href!) } : undefined}>
            <Tooltip>{p.label}: {p.score ?? "insufficient data"}, {p.band}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {points.length === 0 && <p className="absolute inset-0 z-[400] flex items-center justify-center bg-surface/70 text-sm text-ink-700">No wards with map locations in this selection.</p>}
      {tilesFailed && <p className="absolute bottom-1 left-1 z-[400] rounded bg-surface/90 px-2 py-1 text-[11px] text-ink-700">Map tiles unavailable — showing ward markers only.</p>}
    </div>
  );
}
