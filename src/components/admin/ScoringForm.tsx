"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/components/client/ApiForm";
import { useToast } from "@/components/client/Toast";

type Ind = { id: string; name: string; unit: string; weight: number; target: number; worst: number; isActive: boolean };

/** Weights, targets and coverage threshold; saving rebuilds every score snapshot. */
export function ScoringForm({ indicators, minCoverage }: { indicators: Ind[]; minCoverage: number }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState(indicators);
  const [cov, setCov] = useState(minCoverage);
  const [pending, setPending] = useState(false);
  const total = rows.filter((r) => r.isActive).reduce((s, r) => s + Number(r.weight || 0), 0);
  const set = (i: number, patch: Partial<Ind>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    setPending(true);
    const res = await apiRequest<{ snapshots: number }>("/api/admin/scoring", "PUT", { indicators: rows.map(({ id, weight, target, worst, isActive }) => ({ id, weight, target, worst, isActive })), minCoverage: cov });
    setPending(false);
    if (!res.ok) return toast.error(res.message);
    toast.success(`Saved. Recalculated ${res.data.snapshots} ward-month scores.`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="table min-w-[640px]">
          <thead><tr><th scope="col">Indicator</th><th scope="col">Weight</th><th scope="col">Share</th><th scope="col">Target (100 pts)</th><th scope="col">Worst (0 pts)</th><th scope="col">Active</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.id}>
              <td>{r.name}<span className="block text-xs text-ink-500">{r.unit}</span></td>
              <td><label className="sr-only" htmlFor={`w-${r.id}`}>Weight for {r.name}</label><input id={`w-${r.id}`} type="number" min="0" max="100" step="1" className="input w-20" value={r.weight} onChange={(e) => set(i, { weight: Number(e.target.value) })} /></td>
              <td className="text-sm">{r.isActive && total ? `${Math.round((r.weight / total) * 100)}%` : "—"}</td>
              <td><label className="sr-only" htmlFor={`t-${r.id}`}>Target for {r.name}</label><input id={`t-${r.id}`} type="number" step="0.1" className="input w-24" value={r.target} onChange={(e) => set(i, { target: Number(e.target.value) })} /></td>
              <td><label className="sr-only" htmlFor={`x-${r.id}`}>Worst value for {r.name}</label><input id={`x-${r.id}`} type="number" step="0.1" className="input w-24" value={r.worst} onChange={(e) => set(i, { worst: Number(e.target.value) })} /></td>
              <td><input type="checkbox" aria-label={`${r.name} active`} checked={r.isActive} onChange={(e) => set(i, { isActive: e.target.checked })} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div><label className="label" htmlFor="cov">Minimum data coverage</label><input id="cov" type="number" min="0.1" max="1" step="0.05" className="input w-28" value={cov} onChange={(e) => setCov(Number(e.target.value))} /><p className="hint">Below this share of total weight, a ward shows “insufficient data”.</p></div>
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Recalculating…" : "Save & recalculate scores"}</button>
      </div>
    </div>
  );
}
