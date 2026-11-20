"use client";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type LabelProps,
} from "recharts";
import { Download } from "@/components/app-icons";
import { toCsv } from "@/lib/domain/csv";
import { cn } from "@/lib/utils";

export type SeriesDef = { key: string; name: string; color: string; badgeLast?: boolean };
type Row = Record<string, string | number | null>;
type ColumnDef = { key: string; label: string };

const TOOLTIP_STYLE = { background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 8, color: "rgb(var(--ink-900))" };
const TOOLTIP_LABEL = { color: "rgb(var(--ink-900))", fontWeight: 600 };
const BAND_COLOR: Record<string, string> = { Excellent: "#22a04b", Good: "#41c03b", "Needs Attention": "#fe9a22", Critical: "#de0d22" };

/**
 * Wraps every chart: a hidden data table for screen readers, plus two tools for everyone —
 * "Table" swaps the chart for the same numbers as a table, "Download CSV" saves them.
 */
function ChartFrame({ caption, columns, rows, filename, children }: { caption: string; columns: ColumnDef[]; rows: Row[]; filename: string; children: React.ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  const table = (
    <table className="table text-[13px]">
      <caption className={asTable ? "pb-2 text-left text-xs text-ink-500" : undefined}>{caption}</caption>
      <thead><tr>{columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c.key}>{r[c.key] ?? "—"}</td>)}</tr>)}</tbody>
    </table>
  );
  const download = () => {
    const csv = toCsv(rows, columns.map((c) => ({ header: c.label, value: (r: Row) => r[c.key] })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <figure className="m-0">
      {asTable ? <div className="max-h-[360px] overflow-auto rounded-md border border-line">{table}</div> : <>{children}<figcaption className="sr-only">{table}</figcaption></>}
      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
        <button type="button" className="chart-tool" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>{asTable ? "Show chart" : "Show table"}</button>
        <button type="button" className="chart-tool" onClick={download}><Download className="h-3.5 w-3.5" aria-hidden="true" />Download CSV</button>
      </div>
    </figure>
  );
}

/** Buttons that show or hide a series; easier to hit on a phone than a chart legend. */
function SeriesToggles({ series, hidden, onToggle }: { series: Array<{ key: string; name: string; color: string }>; hidden: Set<string>; onToggle: (key: string) => void }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Series shown">
      {series.map((s) => (
        <button key={s.key} type="button" aria-pressed={!hidden.has(s.key)} onClick={() => onToggle(s.key)} className={cn("chart-toggle", hidden.has(s.key) && "opacity-55")}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />{s.name}
        </button>
      ))}
    </div>
  );
}

function useHiddenSeries() {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) => setHidden((h) => { const next = new Set(h); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  return { hidden, toggle };
}

/** Multi-line monthly trend (development score, resolution rate, satisfaction). */
export function TrendChart({ data, series, height = 230, caption, filename = "development-trends" }: { data: Array<Record<string, number | string | null>>; series: SeriesDef[]; height?: number; caption: string; filename?: string }) {
  const lastIdx = data.length - 1;
  const lastLabel = (s: SeriesDef) => function LastValueLabel(props: LabelProps): React.ReactElement<SVGElement> {
    const { x, y, value, index } = props as LabelProps & { index: number };
    if (!s.badgeLast || index !== lastIdx || value == null) return <g />;
    const nx = Number(x), ny = Number(y);
    return (
      <g>
        <rect x={nx - 22} y={ny - 30} width={44} height={20} rx={4} fill="#0b2459" />
        <text x={nx} y={ny - 16} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700}>{String(value)}</text>
      </g>
    );
  };
  return (
    <ChartFrame caption={caption} filename={filename} rows={data} columns={[{ key: "label", label: "Month" }, ...series.map((s) => ({ key: s.key, label: s.name }))]}>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 28, right: 18, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number) => (v == null ? "—" : v)} contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.4} dot={{ r: 3.5, fill: s.color }} connectNulls label={lastLabel(s)} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Complaints reported and resolved each month (bars) with the resolution rate (line, right axis). */
export function ActivityChart({ data, height = 260, caption, filename = "complaints-by-month" }: { data: Array<{ label: string; reported: number; resolved: number; resolution: number | null }>; height?: number; caption: string; filename?: string }) {
  const { hidden, toggle } = useHiddenSeries();
  const series = [
    { key: "reported", name: "Reported", color: "#1b66e3" },
    { key: "resolved", name: "Resolved", color: "#22a04b" },
    { key: "resolution", name: "Resolution rate (%)", color: "#fe9a22" },
  ];
  return (
    <ChartFrame caption={caption} filename={filename} rows={data} columns={[{ key: "label", label: "Month" }, ...series.map((s) => ({ key: s.key, label: s.name }))]}>
      <SeriesToggles series={series} hidden={hidden} onToggle={toggle} />
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} ticks={[0, 50, 100]} unit="%" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number, name: string) => (v == null ? "—" : name === "Resolution rate (%)" ? `${v}%` : v)} contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} />
            {!hidden.has("reported") && <Bar yAxisId="count" dataKey="reported" name="Reported" fill="#1b66e3" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />}
            {!hidden.has("resolved") && <Bar yAxisId="count" dataKey="resolved" name="Resolved" fill="#22a04b" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />}
            {!hidden.has("resolution") && <Line yAxisId="pct" type="monotone" dataKey="resolution" name="Resolution rate (%)" stroke="#fe9a22" strokeWidth={2.4} dot={{ r: 3 }} connectNulls isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Districts ranked by development score, coloured by status band. */
export function DistrictRankChart({ data, caption, filename = "district-scores" }: { data: Array<{ name: string; score: number | null; band: string }>; caption: string; filename?: string }) {
  const rows = data.filter((d) => d.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const missing = data.length - rows.length;
  const height = Math.max(160, rows.length * 24 + 36);
  return (
    <ChartFrame caption={caption} filename={filename} rows={rows} columns={[{ key: "name", label: "District" }, { key: "score", label: "Development score" }, { key: "band", label: "Status" }]}>
      {rows.length === 0 ? <p className="py-8 text-center text-sm text-ink-500">No district has a development score for this selection yet.</p> : (
        <div style={{ height }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 4 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis type="category" dataKey="name" width={150} interval={0} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => (v == null ? "—" : `${v} / 100`)} contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} cursor={{ fill: "rgb(var(--brand-100))", opacity: 0.5 }} />
              <Bar dataKey="score" name="Development score" radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false}>
                {rows.map((r) => <Cell key={r.name} fill={BAND_COLOR[r.band] ?? "#8a96ad"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {missing > 0 && <p className="mt-1 text-xs text-ink-500">{missing} {missing === 1 ? "district has" : "districts have"} no score yet and {missing === 1 ? "is" : "are"} not shown.</p>}
    </ChartFrame>
  );
}

/** The eight scoring indicators of the selected area on one radar, 0–100 on every axis. */
export function IndicatorRadar({ data, caption, height = 300, filename = "indicator-profile" }: { data: Array<{ name: string; score: number | null }>; caption: string; height?: number; filename?: string }) {
  const rows = data.filter((d) => d.score != null);
  return (
    <ChartFrame caption={caption} filename={filename} rows={data} columns={[{ key: "name", label: "Indicator" }, { key: "score", label: "Score (0–100)" }]}>
      {rows.length < 3 ? <p className="py-8 text-center text-sm text-ink-500">At least three indicators need readings before the profile can be drawn.</p> : (
        <div style={{ height }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={rows} outerRadius="72%" margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={{ fontSize: 10 }} axisLine={false} />
              <Tooltip formatter={(v: number) => (v == null ? "—" : `${v}%`)} contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} />
              <Radar dataKey="score" name="Score" stroke="#1b66e3" fill="#1b66e3" fillOpacity={0.22} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  );
}
