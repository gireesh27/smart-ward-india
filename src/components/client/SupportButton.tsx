"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp } from "@/components/app-icons";
import { useToast } from "./Toast";

/** "Support" toggle for a public report. Signed-out visitors are sent to sign in. */
export function SupportButton({ complaintId, count, supported, signedIn = true, compact = false }: { complaintId: string; count: number; supported: boolean; signedIn?: boolean; compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState({ count, supported });
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (!signedIn) { router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`); return; }
    setPending(true);
    const res = await fetch(`/api/complaints/${complaintId}/support`, { method: state.supported ? "DELETE" : "POST" }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setPending(false);
    if (!res?.ok) { toast.error(json?.error?.message ?? "Could not update your support. Try again."); return; }
    setState({ count: json.data.supportCount, supported: json.data.supported });
    if (json.data.supported) toast.success("Thanks — your support was added.");
  }

  return (
    <button type="button" onClick={toggle} disabled={pending} aria-pressed={state.supported}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-colors ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${state.supported ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700" : "border-line-strong bg-surface text-ink-900 hover:border-brand-400"}`}>
      <ThumbsUp className="h-4 w-4" aria-hidden="true" />
      <span>{state.supported ? "Supported" : "Support"}</span>
      <span className="tabular-nums opacity-80" aria-label={`${state.count} supporters`}>{state.count}</span>
    </button>
  );
}
