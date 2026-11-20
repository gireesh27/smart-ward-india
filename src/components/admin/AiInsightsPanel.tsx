"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "@/components/app-icons";
import { useToast } from "@/components/client/Toast";

/** Starts an AI analysis for the chosen district and refreshes the page when the report is stored. */
export function AiInsightsPanel({ districts, defaultDistrict, allowStateWide, available, reason }: {
  districts: Array<{ id: string; name: string }>; defaultDistrict?: string; allowStateWide: boolean; available: boolean; reason?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [district, setDistrict] = useState(defaultDistrict ?? (allowStateWide ? "" : districts[0]?.id ?? ""));
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { if (!busy) return; const t = setInterval(() => setElapsed((e) => e + 1), 1000); return () => clearInterval(t); }, [busy]);

  async function run() {
    setBusy(true); setElapsed(0);
    const res = await fetch("/api/admin/ai-insights", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ districtId: district || undefined }) }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) { toast.error(json?.error?.message ?? "The analysis could not be generated."); return; }
    toast.success(json.data.status === "OK" ? "AI analysis ready." : "AI analysis stored with warnings — see the report.");
    router.push(`/admin/insights?ai=${encodeURIComponent(district)}#ai`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div><label className="label" htmlFor="ai-d">Area to analyse</label>
        <select id="ai-d" className="select w-72 max-w-full" value={district} onChange={(e) => setDistrict(e.target.value)} disabled={busy}>
          {allowStateWide && <option value="">All of Andhra Pradesh (by district)</option>}
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name} district (by mandal / municipality)</option>)}
        </select></div>
      <button type="button" onClick={run} disabled={busy || !available || (!allowStateWide && !district)}
        className="btn-primary h-10">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        {busy ? `Analysing (${elapsed} s)` : "Generate analysis"}
      </button>
      {!available && <p className="w-full text-sm text-ink-500">AI is not configured ({reason}). Rule-based alerts still work. See <code>docs/AI.md</code> — a free local model takes two commands.</p>}
      {busy && <p className="w-full text-xs text-ink-500" role="status">Local models can take 30–120 seconds on a laptop CPU.</p>}
    </div>
  );
}
