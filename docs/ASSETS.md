# Assets: logo, photos and icons

## What you need to add yourself

The reference designs use photographs (four smiling residents in front of a city skyline, a village
road, a government building) and a tricolour logo. These are **not shipped**, because they must be
licensed photos you choose. The site already reads them from `public/assets/` when present:

| Put this file | Appears in | Fallback until you add it |
|---|---|---|
| `public/assets/brand/logo.svg` (or `.png`) | Header (48 px) | Built-in tricolour map-pin mark |
| `public/assets/hero/citizens.webp` (`.jpg`/`.png` also work) | Landing hero: fills the whole band behind the headline, as in the reference | Andhra Pradesh map from the boundary files, with the LGD coverage figures |
| `public/assets/landing/vision.webp` | Vision & Mission card: right two-thirds, fading under the text | Faint road icon (Phosphor, duotone) |
| `public/assets/landing/partners.webp` | Partner with Us card: right two-thirds, fading under the text | Faint government-building icon (Phosphor, duotone) |
| `public/assets/admin/sidebar-building.webp` | Admin sidebar, bottom | Small drawing of a public building |

While you run `npm run dev`, every empty slot shows a dashed note naming the exact file to add. Production
builds never show these notes; visitors see the fallback in the last column.

Steps:
1. Choose an image you are allowed to use (below). Prefer WebP; keep each under about 300 KB (use squoosh.app).
2. Save it with the exact name above (lower case).
3. Add a line to `public/assets/CREDITS.md` (author, source URL, licence).
4. Refresh the page; in production, redeploy (files in `public/` are part of the image).

Images render through `next/image` (lazy loading, responsive sizes) and are marked decorative where they add no information.

## Where to get images legally

- **Unsplash, Pexels**: free for commercial use; credit is courteous. Search "Andhra Pradesh village", "Vijayawada", "Indian family".
- **Wikimedia Commons**: per-file Creative Commons licences; you must credit the author and licence (e.g. CC BY-SA 4.0).
- **Government of India Open Data Licence (GODL)** material from data.gov.in; other government photo portals only under their own stated terms.
- **Not Google Images**: search results are other people's copyrighted work; Google only indexes them.
- Avoid identifiable children and anything that implies endorsement by a person or department.

## Logos and national symbols

- **Do not use the State Emblem of India (Lion Capital)**. The State Emblem of India (Prohibition of Improper Use) Act, 2005 forbids its use by private parties, and in any trade mark or design, without authorisation.
- Tricolour colours in an abstract mark are fine; do not reproduce the national flag itself as a logo.
- Any map of India must show the boundaries as published by the Survey of India. The built-in mark shows only a map pin.
- Partner or department logos only with written permission.

## Icons

One family everywhere: **Phosphor Icons** (MIT), regular weight, duotone on the landing feature
strip. All components import from `src/components/app-icons.tsx`; to change an icon, edit that file
(the right-hand name is the Phosphor icon; browse them at phosphoricons.com).

## How the photos are placed (same as the reference design)

- **Hero (`hero/citizens.webp`)**: the photo covers the whole hero band and the headline sits on its left.
  A soft wash on the left keeps the text readable; below 1024 px the wash runs top to bottom and the
  photo shows in the band under the text. Use a landscape photo of at least **1920×800**, with the people
  and buildings in the **right half** and calm sky or space on the left third. The page shows its
  centre-right (`object-position: 68%`); to change that, edit `object-[68%_center]` on the hero `<Image>`
  in `src/app/(public)/page.tsx`. To make the wash lighter or stronger, edit `.hero-scrim` in
  `src/app/globals.css`.
- **Vision & Mission and Partner with Us (`landing/vision.webp`, `landing/partners.webp`)**: the photo
  fills the right two-thirds of the card body and fades into the card under the text (`CardBackdrop`,
  `src/components/site/CardBackdrop.tsx`; fade: `.card-backdrop-fade` in `globals.css`). Use **800×600**
  or larger with the subject on the right.
- **Admin sidebar (`admin/sidebar-building.webp`)**: bottom of the dark sidebar, under the slogan.

After adding or replacing a file, reload the page (in production, restart the app or redeploy). WebP
gives the smallest files; the site also serves AVIF/WebP versions automatically through `next/image`.
