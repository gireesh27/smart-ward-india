// Small original drawing of a colonnaded public building: admin sidebar artwork until the owner adds
// public/assets/admin/sidebar-building.webp (docs/ASSETS.md).
export function BuildingScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 140" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
      <rect width="150" height="140" style={{ fill: "var(--scene-sky)" }} />
      <rect x="10" y="70" width="130" height="60" fill="#f3efe6" />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={16 + i * 14} y="78" width="6" height="48" fill="#fffdf7" stroke="#d8cfbb" />)}
      <rect x="6" y="64" width="138" height="8" fill="#e4dccb" />
      <rect x="62" y="30" width="26" height="36" fill="#efe8d8" />
      <path d="M60 32c0-14 7-20 15-20s15 6 15 20z" fill="#d7b46a" />
      <rect x="74.5" y="2" width="1.5" height="12" fill="#888" />
      <path d="M0 128h150v12H0z" fill="#7fbf5a" />
    </svg>
  );
}
