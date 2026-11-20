"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "@/components/app-icons";

export type ThemeMode = "light" | "dark" | "system";
const KEY = "sw-theme";
const EVENT = "sw-theme-change";

/** Applied before first paint by the inline script in the root layout (no flash). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

function apply(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

const OPTIONS: Array<{ mode: ThemeMode; label: string; Icon: typeof Sun }> = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
  { mode: "system", label: "System", Icon: Monitor },
];

/** Light / Dark / System switch with an animated thumb. Several instances on a page stay in sync. */
export function ThemeToggle({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [id] = useState(() => `tt-${Math.random().toString(36).slice(2, 8)}`);
  useEffect(() => {
    const read = () => setMode(((localStorage.getItem(KEY) as ThemeMode | null) ?? "light"));
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => { if (localStorage.getItem(KEY) === "system") apply("system"); };
    window.addEventListener(EVENT, read);
    mq.addEventListener("change", onSystem);
    return () => { window.removeEventListener(EVENT, read); mq.removeEventListener("change", onSystem); };
  }, []);
  function choose(m: ThemeMode) {
    try { if (m === "light") localStorage.removeItem(KEY); else localStorage.setItem(KEY, m); } catch { /* private mode */ }
    apply(m);
    setMode(m);
    window.dispatchEvent(new Event(EVENT));
  }
  const dark = tone === "dark";
  return (
    <div role="radiogroup" aria-label="Colour theme" className={cn("isolate inline-flex shrink-0 items-center gap-0.5 rounded-full p-1 backdrop-blur", dark ? "bg-white/10 ring-1 ring-white/20" : "bg-surface/70 ring-1 ring-line", className)}>
      {OPTIONS.map(({ mode: m, label, Icon }) => {
        const on = mode === m;
        return (
          <button key={m} type="button" role="radio" aria-checked={on} aria-label={`${label} theme`} title={`${label} theme`} onClick={() => choose(m)}
            className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${on ? "text-white" : dark ? "text-white/75 hover:text-white" : "text-ink-500 hover:text-ink-900"}`}>
            {on && <motion.span layoutId={id} className="absolute inset-0 -z-10 rounded-full bg-brand-600" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <motion.span key={`${m}-${on}`} initial={on ? { rotate: -90, scale: 0.6 } : false} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}><Icon className="h-4 w-4" aria-hidden="true" /></motion.span>
          </button>
        );
      })}
    </div>
  );
}
