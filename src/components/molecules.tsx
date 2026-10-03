"use client";

import { Apple, ArrowLeft, Beef, Camera, Fish, IceCreamCone, Loader2, MapPin, Milk, Package, Pill, Snowflake, Star, Thermometer, Truck } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { CARGO, STATUS, fa, jDateTime, mmss, stars, tempClass, tempClassLabel, tempRange } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import type { CargoKind, OrderStatus } from "@/lib/types";
import { Badge, cx } from "./ui";
import { toast } from "./Toaster";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status];
  return <Badge tone={s.tone} dot key={status} className="animate-pop">{s.label}</Badge>;
}

/** Class label and range come from the same tempClass(), so they can never contradict each other. */
export function TempChip({ min, max }: { min: number; max: number }) {
  const c = tempClass(min, max);
  const tone = c === "frozen" ? "bg-accent-50 text-accent-700" : c === "cool" ? "bg-ok-bg text-ok" : "bg-surface-3 text-ink-2";
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", tone)}>
      {c === "frozen" ? <Snowflake className="size-3.5" aria-hidden /> : <Thermometer className="size-3.5" aria-hidden />}
      {tempClassLabel(min, max)} · {tempRange(min, max)}
    </span>
  );
}

export function Chip2({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold text-ink-2">{icon}{children}</span>;
}

export function RatingPill({ r }: { r?: { avg: number; count: number } }) {
  if (!r) return <span className="text-xs text-ink-3">بدون امتیاز</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-bold" aria-label={`امتیاز ${stars(r.avg)} از ${fa(r.count)} رأی`}><Star className="size-3.5 fill-brand-500 text-brand-500" aria-hidden />{stars(r.avg)}<span className="font-normal text-ink-3">({fa(r.count)})</span></span>;
}

export function Countdown({ until, total }: { until: number; total: number }) {
  const now = useNow(250);
  const left = until - now;
  const pct = Math.max(0, (left / (total * 1000)) * 100);
  const danger = left < 30_000;
  return (
    <div className="space-y-1.5" role="timer" aria-live="off">
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-3">مهلت تأیید نهایی</span>
        <span className={cx("font-black tabular", danger ? "text-danger" : "text-ink")}>{mmss(left)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div className={cx("h-full rounded-full transition-[width] duration-300", danger ? "bg-danger" : "bg-brand-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Route line used inside cards: origin ● ─ ● destination. */
export function RouteLine({ from, to, sub }: { from: string; to: string; sub?: [string, string] }) {
  return (
    <div className="flex items-stretch gap-3">
      <div className="flex flex-col items-center py-1.5">
        <span className="size-2.5 rounded-full border-2 border-accent-600 bg-white" />
        <span className="my-1 w-px flex-1 bg-line" />
        <span className="size-2.5 rounded-full bg-ink" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2.5">
        <div><div className="font-bold leading-6">{from}</div>{sub && <div className="text-[13px] text-ink-3">{sub[0]}</div>}</div>
        <div><div className="font-bold leading-6">{to}</div>{sub && <div className="text-[13px] text-ink-3">{sub[1]}</div>}</div>
      </div>
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="group" aria-label="فیلترها">{children}</div>;
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cx("h-11 shrink-0 rounded-full px-4 text-sm font-medium transition", active ? "bg-ink text-white" : "bg-white text-ink-2 shadow-soft hover:bg-surface-3")}>
      {children}
    </button>
  );
}

/** Decorative pin used in lists/legends — same visual language as the map pin. */
export function MapPinIcon({ tone = "brand" }: { tone?: "brand" | "accent" }) {
  return <span className={cx("grid size-8 place-items-center rounded-full", tone === "brand" ? "bg-brand-500 text-ink" : "bg-accent-600 text-white")}><MapPin className="size-4" /></span>;
}

export const BackLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-accent-600 hover:underline">
    {children}
    <ArrowLeft className="size-4 rotate-180" />
  </Link>
);

/* ───────── Image capture: downscale + stamp timestamp & GPS on the pixels ───────── */

export interface Captured { dataUrl: string; takenAt: number; lat: number; lng: number }

async function getPos(fallback: { lat: number; lng: number }): Promise<{ lat: number; lng: number }> {
  // The browser's own `timeout` only starts after the permission prompt is answered, so race it with ours.
  return new Promise((res) => {
    const t = setTimeout(() => res(fallback), 2500);
    if (!navigator.geolocation) { clearTimeout(t); return res(fallback); }
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { clearTimeout(t); res(fallback); },
      { timeout: 2500, maximumAge: 60_000 },
    );
  });
}

export async function stampImage(file: File, stamp: boolean, fallback = { lat: 35.6892, lng: 51.389 }): Promise<Captured> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  const max = 720;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  const takenAt = Date.now();
  const pos = stamp ? await getPos(fallback) : fallback;
  if (stamp) {
    const text = `${jDateTime(takenAt)}  ·  ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
    ctx.font = "600 14px Vazirmatn, sans-serif";
    const w = ctx.measureText(text).width + 20;
    ctx.fillStyle = "rgba(17,24,39,.72)";
    ctx.fillRect(0, c.height - 30, w, 30);
    ctx.fillStyle = "#ffb000";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 10, c.height - 15);
  }
  return { dataUrl: c.toDataURL("image/jpeg", 0.7), takenAt, ...pos };
}

export function FileDrop({
  label, hint, value, onChange, stamp = false, capture = false, fallback,
}: {
  label: string; hint?: string; value?: string; onChange: (c: Captured) => void; stamp?: boolean; capture?: boolean; fallback?: { lat: number; lng: number };
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" onClick={() => ref.current?.click()}
      className={cx("group relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-ui border-2 border-dashed p-3 text-center transition",
        value ? "border-transparent" : "border-line bg-white hover:border-accent-600 hover:bg-accent-50")}>
      <input ref={ref} type="file" accept="image/*" capture={capture ? "environment" : undefined} hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try { onChange(await stampImage(f, stamp, fallback)); } catch { toast("خواندن تصویر ممکن نشد. دوباره تلاش کنید.", "err"); }
          setBusy(false);
          e.target.value = "";
        }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value && <img src={value} alt={label} className="absolute inset-0 size-full object-cover" />}
      {value && <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-1.5 text-xs font-medium text-white">{label} · برای تعویض بزنید</span>}
      {!value && (
        <>
          {busy ? <Loader2 className="size-6 animate-spin text-accent-600" /> : <Camera className="size-6 text-ink-3 group-hover:text-accent-600" />}
          <span className="text-sm font-bold">{label}</span>
          {hint && <span className="text-xs leading-5 text-ink-3">{hint}</span>}
        </>
      )}
    </button>
  );
}

export { Truck };

const CARGO_ICON = { dairy: Milk, meat: Beef, fish: Fish, produce: Apple, pharma: Pill, icecream: IceCreamCone, dry: Package, other: Package } as const;
export function CargoIcon({ type, className = "size-4" }: { type: CargoKind; className?: string }) {
  const I = CARGO_ICON[type];
  return <I className={className} aria-hidden />;
}
export function CargoLabel({ type }: { type: CargoKind }) {
  return <span className="inline-flex items-center gap-1.5"><CargoIcon type={type} />{CARGO[type].label}</span>;
}

