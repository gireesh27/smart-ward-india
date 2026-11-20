// Decorative skyline for the admin canvas header (stands in for the reference photo).
export function Skyline({ className = "" }: { className?: string }) {
  const b = [[0, 50, 40], [44, 80, 30], [80, 60, 46], [130, 110, 34], [170, 70, 52], [228, 95, 40], [272, 58, 60], [338, 125, 36], [380, 84, 48], [434, 66, 40],
    [480, 102, 44], [530, 76, 56], [592, 132, 38], [636, 90, 46], [688, 62, 54], [748, 116, 40], [794, 80, 50], [850, 100, 36], [892, 70, 58], [956, 120, 42], [1004, 86, 50]];
  return (
    <svg viewBox="0 0 1060 140" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9cc3f2" stopOpacity=".55" /><stop offset="1" stopColor="#163d7a" stopOpacity=".1" /></linearGradient></defs>
      {b.map(([x, h, w], i) => <rect key={i} x={x} y={140 - h} width={w - 4} height={h} fill="url(#sk)" />)}
      <path d="M560 140V88h60v52zM566 88c0-20 12-32 24-32s24 12 24 32z" fill="#bcd6f5" opacity=".35" />
    </svg>
  );
}
