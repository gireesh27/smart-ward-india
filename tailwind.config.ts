import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Design tokens sampled from docs/reference/*.jpg — see docs/ARCHITECTURE.md.
// Tokens that must change in dark mode are CSS variables (defined in globals.css),
// so every page themes from one place and opacity modifiers (e.g. bg-surface/90) still work.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: v("surface"),       // cards, inputs, menus
        canvas: v("canvas"),         // page background
        muted: v("muted"),           // subtle fills
        track: v("track"),           // progress tracks, skeletons
        line: v("line"),             // borders
        "line-strong": v("line-strong"),
        navy: {
          950: "#03153a", 900: "#002e64", 850: "#011945", 800: "#05214f",
          700: v("navy-700"),        // display headings (lightens in dark mode)
          600: "#164c8f",
        },
        brand: { 700: "#004a9f", 600: "#0059bc", 500: "#0066f9", 400: "#3d8bfd", 100: v("brand-100"), 50: v("brand-50") },
        saffron: { 600: "#ea7c0c", 500: "#fe9a22", 100: v("saffron-100") },
        leaf: { 700: "#12893b", 600: "#22a04b", 500: "#41c03b", 100: v("leaf-100") },
        alert: { 600: "#de0d22", 500: "#e8333f", 100: v("alert-100") },
        amber: { 500: "#ffa918", 100: v("amber-100") },
        ink: { 900: v("ink-900"), 700: v("ink-700"), 500: v("ink-500"), 300: v("ink-300") },
        tile: {
          water: v("tile-water"), roads: v("tile-roads"), drainage: v("tile-drainage"),
          garbage: v("tile-garbage"), electricity: v("tile-electricity"), streetlight: v("tile-streetlight"),
        },
        kpi: { blue: "#0a5ce0", green: "#0e7a3c", orange: "#ea7208", purple: "#4a2fae" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Poppins", "var(--font-telugu)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "Atkinson Hyperlegible", "var(--font-telugu)", "system-ui", "sans-serif"],
        script: ["var(--font-script)", "cursive"],
      },
      boxShadow: {
        card: "0 2px 10px rgb(var(--shadow) / 0.10)",
        float: "0 10px 30px rgb(var(--shadow) / 0.16)",
        kpi: "0 8px 22px rgba(0, 0, 0, 0.28)",
      },
      borderRadius: { card: "10px" },
      maxWidth: { page: "1536px" },
    },
  },
  plugins: [animate],
};
export default config;
