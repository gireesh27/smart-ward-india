"use client";
import dynamic from "next/dynamic";

export type LatLng = { lat: number; lng: number } | null;
const Inner = dynamic(() => import("./LocationPickerInner"), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

export function LocationPicker(props: { value: LatLng; center: { lat: number; lng: number }; onChange: (v: LatLng) => void }) {
  return <div className="h-56 overflow-hidden rounded-md border border-line"><Inner {...props} /></div>;
}
