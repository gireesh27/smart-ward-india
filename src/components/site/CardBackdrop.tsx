import Image from "next/image";
import { AssetHint } from "./AssetHint";

/**
 * Photo behind the right part of a card body that fades into the card, so the text can sit on its
 * left as in the reference design. Put it first inside a `relative isolate overflow-hidden` body.
 */
export function CardBackdrop({ src, file, size, fallback }: { src: string | null; file: string; size: string; fallback: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-[68%]" aria-hidden="true">
      {src
        ? <Image src={src} alt="" fill sizes="(min-width: 1536px) 260px, (min-width: 768px) 34vw, 68vw" className="object-cover" />
        : <span className="absolute inset-0 flex items-center justify-end pr-3 text-brand-600/25">{fallback}</span>}
      <span className="card-backdrop-fade absolute inset-0" />
      {!src && <AssetHint compact file={file} size={size} className="left-auto w-[70%]" />}
    </div>
  );
}
