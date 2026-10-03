"use client";

import { Crown } from "lucide-react";
import { cx } from "./ui";

/** Wordmark: truck mark + «کامیونت». SVG only, no emoji. */
export function Logo({ className, tone = "ink" }: { className?: string; tone?: "ink" | "white" }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-black", tone === "white" ? "text-white" : "text-ink", className)}>
      <svg viewBox="0 0 40 40" className="size-8" aria-hidden>
        <rect width="40" height="40" rx="11" fill="#FFB000" />
        <path d="M8 24V14h13v10M21 17h6l4 4v3H21" fill="none" stroke="#111827" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="14" cy="26" r="2.6" fill="#146EB4" stroke="#111827" strokeWidth="1.8" />
        <circle cx="27" cy="26" r="2.6" fill="#146EB4" stroke="#111827" strokeWidth="1.8" />
        <path d="M11 11l3-3M15 11V8" stroke="#146EB4" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="text-lg leading-none">کامیونت</span>
    </span>
  );
}

export function ProBadge({ className, label = "پرو" }: { className?: string; label?: string }) {
  return (
    <span className={cx("pro-badge", className)}>
      <Crown className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

/** Persistent identity cue shown in every portal header. */
export function PortalCue({ label, tone }: { label: string; tone: "shipper" | "driver" | "admin" }) {
  const c = { shipper: "bg-accent-600 text-white", driver: "bg-brand-500 text-ink", admin: "bg-slate-700 text-white" }[tone];
  return <span className={cx("rounded-full px-3 py-1 text-xs font-extrabold", c)}>{label}</span>;
}
