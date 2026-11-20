// Approximate, hand-traced silhouette of Andhra Pradesh for orientation only.
// NOT an official boundary — it is labelled as illustrative wherever it is shown.
const OUTLINE: Array<[number, number]> = [
  [84.75, 19.05], [84.42, 18.62], [84.1, 18.28], [83.55, 17.95], [83.3, 17.68], [82.85, 17.35], [82.3, 16.95], [82.32, 16.6],
  [81.75, 16.32], [81.15, 16.15], [80.92, 15.75], [80.32, 15.6], [80.1, 15.1], [80.05, 14.45], [80.15, 13.9], [80.25, 13.45],
  [79.95, 13.38], [79.4, 13.3], [78.62, 12.65], [78.2, 13.0], [77.55, 13.35], [77.0, 13.95], [76.82, 14.6], [77.1, 15.1],
  [76.92, 15.62], [77.42, 15.92], [78.2, 16.02], [79.0, 16.25], [79.6, 16.62], [80.1, 16.88], [80.55, 17.02], [81.02, 17.42],
  [81.32, 17.8], [81.72, 17.88], [82.05, 18.12], [82.42, 18.42], [82.95, 18.62], [83.42, 18.92], [83.9, 19.12], [84.42, 19.12],
];
const LON0 = 76.5, LAT0 = 19.4, K = 40;
export const projectAP = (lon: number, lat: number) => ({ x: (lon - LON0) * K, y: (LAT0 - lat) * K });

export function APOutline({ pin, label = "Andhra Pradesh", className = "" }: { pin?: { lon: number; lat: number; title: string }; label?: string; className?: string }) {
  const d = OUTLINE.map(([lon, lat], i) => { const p = projectAP(lon, lat); return `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" ") + "Z";
  const pp = pin ? projectAP(pin.lon, pin.lat) : null;
  return (
    <svg viewBox="0 0 345 290" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Illustrative outline of ${label}, not an official boundary${pin ? `, with a marker at ${pin.title}` : ""}`} className={className}>
      <defs><linearGradient id="apg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3f8cf0" /><stop offset="1" stopColor="#1557c0" /></linearGradient></defs>
      <path d={d} fill="url(#apg)" strokeWidth="2" strokeLinejoin="round" style={{ stroke: "rgb(var(--surface))" }} />
      {pp && (
        <g transform={`translate(${pp.x} ${pp.y})`}>
          <path d="M0 0c-8-10-12-16-12-22a12 12 0 1 1 24 0c0 6-4 12-12 22z" fill="#e8333f" stroke="#fff" strokeWidth="2.5" transform="translate(0 -2)" />
          <circle cx="0" cy="-24" r="4.5" fill="#fff" />
          <title>{pin?.title}</title>
        </g>
      )}
    </svg>
  );
}
