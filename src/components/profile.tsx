"use client";

import { BadgeCheck, Star } from "lucide-react";
import type { ReactNode } from "react";
import { fa } from "@/lib/format";
import { cx } from "./ui";

/** Crown drawn as SVG (no emoji). */
export function CrownMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={cx("crown-pop", className)} aria-hidden>
      <defs><linearGradient id="crg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b8" /><stop offset=".5" stopColor="#f5c451" /><stop offset="1" stopColor="#c98a10" /></linearGradient></defs>
      <path d="M4 26 2 8l11 9 11-14 11 14 11-9-2 18z" fill="url(#crg)" stroke="#8a5a06" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="4" y="26" width="40" height="4" rx="2" fill="#c98a10" />
      <circle cx="2" cy="8" r="2.4" fill="#fff1b8" /><circle cx="24" cy="3" r="2.6" fill="#fff1b8" /><circle cx="46" cy="8" r="2.4" fill="#fff1b8" />
    </svg>
  );
}

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("‌");

export function Avatar({ name, hue = 210, pro, size = 64, src, className }: { name: string; hue?: number; pro?: boolean; size?: number; src?: string; className?: string }) {
  const inner = (
    <span className="grid place-items-center overflow-hidden rounded-full bg-white font-black text-white ring-2 ring-white" style={{ width: size, height: size, background: `hsl(${hue} 62% 42%)`, fontSize: size * 0.36 }}>
      {src ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  );
  if (!pro) return <span className={cx("inline-block shrink-0", className)}>{inner}</span>;
  return (
    <span className={cx("relative inline-block shrink-0", className)} style={{ paddingTop: size * 0.28 }}>
      <CrownMark className="absolute start-1/2 top-0 -translate-x-1/2 rtl:translate-x-1/2" />
      <span className="pro-ring block" style={{ width: size + 6, height: size + 6 }}>{inner}</span>
    </span>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return <div className="rounded-2xl bg-white/70 p-3 text-center shadow-soft ring-1 ring-white"><div className="text-xl font-black tabular tracking-tight">{value}</div><div className="mt-0.5 text-[11px] font-bold text-ink-3">{label}</div>{sub && <div className="text-[10px] text-ink-4">{sub}</div>}</div>;
}

/**
 * Social-profile style header: cover, overlapping avatar, name + headline, badges, stat tiles.
 * Pro profiles switch to the midnight/gold cover and get the crowned avatar.
 */
export function ProfileHero({ name, headline, hue, pro, verified, badges, stats, rating, ratingCount, actions, cover }: {
  name: string; headline?: string; hue?: number; pro?: boolean; verified?: boolean; badges?: ReactNode; stats: { label: string; value: ReactNode; sub?: string }[]; rating?: number; ratingCount?: number; actions?: ReactNode; cover?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-soft">
      <div className={cx("relative h-24 sm:h-32", pro ? "pro-card rounded-none!" : "")} style={pro ? undefined : { background: cover ?? `hsl(${hue ?? 210} 58% 46%)` }}>
        {!pro && <div className="grid-dots absolute inset-0 opacity-50 mix-blend-overlay" aria-hidden />}
        {pro && <span className="absolute end-4 top-4 text-xs font-extrabold tracking-wide pro-gold-text">کامیونت پرو</span>}
        {actions && <div className="absolute start-3 top-3 z-10 flex gap-2">{actions}</div>}
      </div>
      <div className="px-5 pb-5">
        <div className="relative z-10 -mt-11 sm:-mt-12"><Avatar name={name} hue={hue} pro={pro} size={84} /></div>
        <div className="mt-3 min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-black leading-tight sm:text-2xl">{name}{verified && <BadgeCheck className="size-6 text-accent-600" aria-label="تأییدشده" />}</h1>
          {headline && <p className="mt-1 text-sm text-ink-3">{headline}</p>}
        </div>
        {(rating !== undefined || badges) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {rating !== undefined && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-black text-brand-700 ring-1 ring-brand-500/20"><Star className="size-4 fill-brand-500 text-brand-500" aria-hidden />{fa(Math.round(rating * 10) / 10)}<span className="font-medium text-ink-3">({fa(ratingCount ?? 0)} نظر)</span></span>}
            {badges}
          </div>
        )}
        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>{stats.map((s) => <StatTile key={s.label} {...s} />)}</div>
      </div>
    </section>
  );
}

export function ReviewItem({ name, hue, rating, text, at }: { name: string; hue?: number; rating: number; text?: string; at?: string }) {
  return (
    <div className="flex gap-3 border-t border-line pt-4 first:border-0 first:pt-0">
      <Avatar name={name} hue={hue} size={40} />
      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="font-bold">{name}</span><span className="inline-flex items-center gap-1 text-sm font-black"><Star className="size-3.5 fill-brand-500 text-brand-500" aria-hidden />{fa(Math.round(rating * 10) / 10)}</span></div>{text ? <p className="mt-1 text-sm leading-7 text-ink-2">{text}</p> : null}{at && <div className="mt-1 text-xs text-ink-4">{at}</div>}</div>
    </div>
  );
}
