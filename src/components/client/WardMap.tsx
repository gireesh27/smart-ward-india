"use client";
import dynamic from "next/dynamic";

export type MapPoint = { id: string; label: string; lat: number; lng: number; score: number | null; band: string; href?: string };

const Inner = dynamic(() => import("./WardMapInner"), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

/** Ward centroid markers on an attributed tile map. Locations are ward centroids, never complaint addresses. */
export function WardMap(props: { points: MapPoint[]; height?: number; className?: string }) {
  return (
    <div className={props.className} style={{ height: props.height ?? 260 }}>
      <Inner points={props.points} />
      <ul className="sr-only">{props.points.map((p) => <li key={p.id}>{p.label}: {p.score ?? "insufficient data"} ({p.band})</li>)}</ul>
    </div>
  );
}
