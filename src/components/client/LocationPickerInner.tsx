"use client";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "./LocationPicker";
import { AutoResize } from "./WardMapInner";

const TILE = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "&copy; OpenStreetMap contributors";

function Clicks({ onChange }: { onChange: (v: LatLng) => void }) {
  useMapEvents({ click: (e) => onChange({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) }) });
  return null;
}
function Recenter({ to }: { to: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => { map.setView([to.lat, to.lng], Math.max(map.getZoom(), 14)); }, [map, to.lat, to.lng]);
  return null;
}

export default function LocationPickerInner({ value, center, onChange }: { value: LatLng; center: { lat: number; lng: number }; onChange: (v: LatLng) => void }) {
  const [failed, setFailed] = useState(false);
  const focus = value ?? center;
  return (
    <div className="relative isolate h-full">
      <MapContainer center={[focus.lat, focus.lng]} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer url={TILE} attribution={ATTR} eventHandlers={{ tileerror: () => setFailed(true) }} />
        <Clicks onChange={onChange} />
        <Recenter to={focus} />
        <AutoResize />
        {value && <CircleMarker center={[value.lat, value.lng]} radius={10} pathOptions={{ color: "#fff", weight: 3, fillColor: "#de0d22", fillOpacity: 1 }} />}
      </MapContainer>
      {failed && <p className="absolute bottom-1 left-1 z-[400] rounded bg-surface/90 px-2 py-1 text-[11px]">Map tiles could not load. You can still enter the address and use your device location.</p>}
    </div>
  );
}
