# UI system

The interface follows the two reference designs and government design practice (UX4G 3.0, GIGW 3.0, WCAG 2.1 AA):
formal, solid surfaces; one icon family; motion only where it answers an action.

## This release
- **Header**: one 72 px bar (56 px on phones) laid out as a grid: brand and subtitle, the tagline after a divider on wide screens, navigation and a solid *Login* / *My portal* pill. Text truncates instead of overlapping at any width.
- **Buttons**: solid colours only. The rainbow glow rim, aurora backgrounds, shimmer, glass panels, pointer spotlight, count-up numbers and per-section entrance animations were **removed** (common tells of generated templates). Earlier sections of this document describing them are historical.
- **Theme**: light by default. Visitors get the light/dark/system switch in the header; signed-in users find it under **Profile → Appearance**.
- **Typography**: Poppins for headings (as in the reference), Atkinson Hyperlegible for body text, Noto Sans Telugu for Telugu.
- **Icons**: Phosphor Icons everywhere through `src/components/app-icons.tsx`.
- **Tables**: sortable headers (`aria-sort`) and removable filter chips, all URL-based.

# Earlier notes

## shadcn/ui
`components.json` configures the shadcn CLI (style "new-york", Tailwind, aliases `@/components`, `@/lib/utils`). Components live in `src/components/ui/` and are plain source you own:

| Component | Built on | Used for |
|---|---|---|
| `button.tsx` | Radix Slot + class-variance-authority | variants: default, glass, outline, ghost, orange, destructive, link |
| `popover.tsx`, `command.tsx` | Radix Popover + cmdk | the searchable Panchayat / Municipality picker |
| `dialog.tsx` | Radix Dialog | confirmation dialogs (deactivate, delete, …) |
| `sheet.tsx` | Radix Dialog | mobile navigation slide-over |
| `dropdown-menu.tsx`, `tooltip.tsx` | Radix | menus and hints |

`src/components/ui/index.tsx` holds the project's own primitives (Card, StatusBadge, Donut, ProgressBar, …). `cn()` in `src/lib/utils.ts` merges classes with `tailwind-merge`. Add more components with `npx shadcn@latest add <name>`.

## Aceternity-style effects
These follow the patterns popularised by Aceternity UI, implemented in this repository with framer-motion and CSS (no code copied from Aceternity):

| Effect | Where | File |
|---|---|---|
| Floating glass navbar: shrinks after scrolling, hides on scroll-down and returns on scroll-up, active pill that glides between links (`layoutId`), hover pill following the pointer | public site | `src/components/site/FloatingNav.tsx` |
| Animated active indicator in the sidebar | admin | `src/components/admin/AdminNavLinks.tsx` |
| Slide-over menu with staggered links | all mobile navigation | `src/components/client/MobileNav.tsx` |
| Aurora gradient background | landing hero, AI panel | `.aurora` in `globals.css` |
| Spotlight border that follows the pointer | KPI and AI insight cards (`.glow-card`) | `GlowTracker.tsx` + CSS |
| Rotating gradient rim on calls to action | "Get Started", Login (`.btn-glow`) | CSS `@property --angle` |
| Count-up numbers | admin KPIs | `src/components/motion/AnimatedNumber.tsx` |
| Fade-and-lift on scroll | public dashboard | `src/components/motion/FadeIn.tsx` |
| Animated theme switch (merges classes with tailwind-merge so callers can position it) | everywhere | `ThemeToggle.tsx` |
| Interactive atlas: layers, pinch-zoom, full screen, search, details panel | `/map`, dashboards | `AtlasMap.tsx` (see docs/MAPS.md) |

## Glassmorphism
- `.glass` (navbar, filter bars), `.glass-strong` (popovers, dialogs, sheets), `.card` and `.admin-panel` (translucent surfaces with backdrop blur and a light inner highlight).
- `.bg-page` paints soft colour fields so there is something behind the glass to blur.
- Dark mode uses darker translucency and subtle borders; all colours come from CSS variables in `globals.css`.
- If a browser lacks `backdrop-filter`, surfaces fall back to solid colours so text stays readable.

## Accessibility and performance
- Every animation respects the operating-system "reduce motion" setting (framer-motion `useReducedMotion` and a CSS media query); the pointer glow only runs on devices that hover.
- Radix primitives provide focus management, Escape to close and screen-reader labels; the picker's search field and options are keyboard-operable.
- Count-up numbers render their final value on the server, so no layout shift or missing numbers without JavaScript.
- Backdrop blur is GPU work; keep the number of stacked glass layers small on pages for low-end phones.
