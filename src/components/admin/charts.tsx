"use client";

import { useId, useState } from "react";
import { fa } from "@/lib/format";
import { cx } from "../ui";

/** Validated categorical slots 1-3 (blue, orange, aqua); status colours are never reused for series. */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

interface LineSeries { name: string; color?: string; points: { x: number; y: number }[] }

/** Thin 2px lines, recessive grid, crosshair + tooltip on hover, legend when ≥ 2 series. */
export function LineChart({ series, h = 220, xLabel, yFmt = fa, className }: { series: LineSeries[]; h?: number; xLabel: (x: number) => string; yFmt?: (n: number) => string; className?: string }) {
  const id = useId();
  const W = 640, P = { l: 44, r: 10, t: 10, b: 24 };
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const ys = series.flatMap((s) => s.points.map((p) => p.y));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(1, ...ys) * 1.1;
  const X = (v: number) => P.l + ((v - x0) / Math.max(1, x1 - x0)) * (W - P.l - P.r);
  const Y = (v: number) => P.t + (1 - v / y1) * (h - P.t - P.b);
  const [hover, setHover] = useState<number | null>(null);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * y1);
  const base = series[0]?.points ?? [];
  const hi = hover === null ? null : base.reduce((b, p, i) => (Math.abs(X(p.x) - hover) < Math.abs(X(base[b].x) - hover) ? i : b), 0);
  return (
    <figure className={className}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${h}`} className="w-full" role="img" aria-label="نمودار خطی" onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(((e.clientX - r.left) / r.width) * W); }}>
          {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={Y(t)} y2={Y(t)} stroke="#e5e7eb" strokeWidth="1" /><text x={P.l - 6} y={Y(t) + 4} fontSize="10" textAnchor="end" fill="#5b6472">{yFmt(t)}</text></g>)}
          {[0, 0.5, 1].map((f) => { const v = x0 + f * (x1 - x0); return <text key={f} x={X(v)} y={h - 6} fontSize="10" textAnchor="middle" fill="#5b6472">{xLabel(v)}</text>; })}
          {series.map((s, i) => <polyline key={s.name} fill="none" stroke={s.color ?? SERIES[i]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={s.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} />)}
          {hi !== null && <g><line x1={X(base[hi].x)} x2={X(base[hi].x)} y1={P.t} y2={h - P.b} stroke="#9ca3af" strokeDasharray="3 3" />{series.map((s, i) => s.points[hi] && <circle key={s.name} cx={X(s.points[hi].x)} cy={Y(s.points[hi].y)} r="4" fill={s.color ?? SERIES[i]} stroke="#fff" strokeWidth="2" />)}</g>}
          <title id={id}>نمودار خطی</title>
        </svg>
        {hi !== null && <div role="tooltip" className="pointer-events-none absolute top-1 rounded-xl bg-ink px-3 py-2 text-xs text-white shadow-lift" style={{ insetInlineStart: `min(${(X(base[hi].x) / W) * 100}%, calc(100% - 9rem))` }}><div className="mb-1 font-bold">{xLabel(base[hi].x)}</div>{series.map((s, i) => <div key={s.name} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: s.color ?? SERIES[i] }} />{s.name}: <b className="tabular">{yFmt(s.points[hi]?.y ?? 0)}</b></div>)}</div>}
      </div>
      {series.length > 1 && <figcaption className="mt-2 flex flex-wrap gap-3 text-xs text-ink-3">{series.map((s, i) => <span key={s.name} className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: s.color ?? SERIES[i] }} />{s.name}</span>)}</figcaption>}
    </figure>
  );
}

/** Horizontal bars (rank/magnitude): 4px rounded data-ends from the baseline, selective labels, hover tooltip. */
export function BarList({ rows, fmt = fa, color = SERIES[0], max }: { rows: { label: string; value: number; sub?: string }[]; fmt?: (n: number) => string; color?: string; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="group" title={`${r.label}: ${fmt(r.value)}${r.sub ? ` · ${r.sub}` : ""}`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]"><span className="truncate font-medium">{r.label}</span><span className="tabular font-bold">{fmt(r.value)}</span></div>
          <div className="h-2 rounded-full bg-surface-3"><div className="h-2 rounded-full transition-[width] duration-500" style={{ width: `${(r.value / m) * 100}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Spark({ values, color = SERIES[0], className }: { values: number[]; color?: string; className?: string }) {
  const W = 80, H = 24;
  const mx = Math.max(1, ...values), mn = Math.min(0, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * W},${H - 2 - ((v - mn) / Math.max(1, mx - mn)) * (H - 4)}`).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} className={cx("h-6 w-20", className)} aria-hidden><polyline fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" points={pts} /></svg>;
}

/** Stacked horizontal share bar with a 2px surface gap and a legend that carries the values (identity is never colour-only). */
export function ShareBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label} ${fa(p.value)}`).join("، ")}>{parts.filter((p) => p.value > 0).map((p) => <span key={p.label} title={`${p.label}: ${fa(p.value)}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}</div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">{parts.map((p) => <li key={p.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: p.color }} />{p.label} <b className="tabular text-ink">{fa(p.value)}</b></li>)}</ul>
    </div>
  );
}
