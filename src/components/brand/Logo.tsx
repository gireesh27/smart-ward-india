// Original marks. The reference logo used an India map; we deliberately avoid a
// national outline (inaccurate boundary depictions are legally sensitive in India).

export function LogoMark({ className = "h-20 w-20" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={`text-navy-700 ${className}`} role="img" aria-label="Smart Ward India logo">
      <defs>
        <clipPath id="pin"><path d="M60 6c-24 0-42 18-42 41 0 30 42 67 42 67s42-37 42-67C102 24 84 6 60 6z" /></clipPath>
      </defs>
      <g clipPath="url(#pin)">
        <rect x="0" y="0" width="120" height="40" fill="#f7931e" />
        <rect x="0" y="40" width="120" height="30" fill="#ffffff" />
        <rect x="0" y="70" width="120" height="60" fill="#12893b" />
      </g>
      <path d="M60 6c-24 0-42 18-42 41 0 30 42 67 42 67s42-37 42-67C102 24 84 6 60 6z" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="60" cy="50" r="13" fill="#fff" stroke="#0d3a73" strokeWidth="3" />
      <circle cx="60" cy="50" r="4" fill="#0d3a73" />
      {/* residents */}
      <g fill="currentColor">
        <circle cx="86" cy="80" r="5" /><path d="M78 100c0-8 4-13 8-13s8 5 8 13z" />
        <circle cx="100" cy="76" r="6" /><path d="M91 100c0-10 4-16 9-16s9 6 9 16z" />
        <circle cx="113" cy="82" r="4.5" /><path d="M106 100c0-7 3-12 7-12s7 5 7 12z" />
      </g>
    </svg>
  );
}

export function AdminLogoMark({ className = "h-16 w-36" }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 80" className={className} role="img" aria-label="Smart Ward India">
      <path d="M8 46C40 10 110 0 172 14 118 12 60 24 22 54z" fill="#f7931e" />
      <path d="M18 58C56 28 120 22 174 30 120 32 70 44 30 66z" fill="#ffffff" />
      <path d="M28 72C68 46 124 42 176 48 126 52 80 62 42 78z" fill="#12893b" />
      <circle cx="96" cy="40" r="17" fill="#0b2a63" />
      <circle cx="96" cy="40" r="12" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="96" cy="40" r="3" fill="#fff" />
    </svg>
  );
}

export function TricolorRibbon({ className = "h-8 w-20" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 40" className={className} aria-hidden="true">
      <path d="M2 18C30 4 64 2 98 8 64 8 34 14 8 26z" fill="#f7931e" />
      <path d="M8 26C36 14 66 12 98 16 66 18 38 24 14 32z" fill="#ffffff" />
      <path d="M14 32C42 22 70 20 98 24 70 26 44 32 22 38z" fill="#12893b" />
      <circle cx="56" cy="17" r="3" fill="#0b2a63" />
    </svg>
  );
}
