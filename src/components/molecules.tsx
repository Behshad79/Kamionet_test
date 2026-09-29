"use client";

import { ArrowLeft, BadgeCheck, Beef, Camera, Clock, IceCreamCone, Loader2, MapPin, Milk, Package, Pill, ShieldAlert, Snowflake, Star, Thermometer, Truck, Wallet, Weight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CARGO, STATUS, VEHICLE_SHORT, fa, jDateTime, jShort, mmss, payLabel, stars, tempClass, tempClassLabel, tempRange, toman, weightLabel, windowLabel } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import type { CargoType, FullView, KycStatus, OrderStatus, OrderView, Role } from "@/lib/types";
import { switchRole } from "@/lib/store";
import type { DriverStanding } from "@/lib/matching";
import { Badge, Card, cx } from "./ui";
import { toast } from "./Toaster";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status];
  return <Badge tone={s.tone} dot key={status} className="animate-pop">{s.label}</Badge>;
}

export function VerificationBadge({ standing }: { standing: DriverStanding | KycStatus }) {
  const map = {
    verified: { tone: "ok", label: "تأییدشده", icon: <BadgeCheck className="size-3.5" /> },
    pending: { tone: "warn", label: "در انتظار بررسی", icon: <Clock className="size-3.5" /> },
    draft: { tone: "neutral", label: "مدارک ناقص", icon: <Clock className="size-3.5" /> },
    none: { tone: "neutral", label: "احراز نشده", icon: <ShieldAlert className="size-3.5" /> },
    rejected: { tone: "danger", label: "نیازمند اصلاح", icon: <ShieldAlert className="size-3.5" /> },
    suspended: { tone: "danger", label: "معلق (مدارک منقضی)", icon: <ShieldAlert className="size-3.5" /> },
  } as const;
  const m = map[standing];
  return <Badge tone={m.tone}>{m.icon}{m.label}</Badge>;
}

export function RoleSwitch({ role }: { role: Role }) {
  const router = useRouter();
  return (
    <div className="relative grid grid-cols-2 rounded-full bg-surface-3 p-1 text-sm font-bold" role="tablist" aria-label="نقش کاربری">
      <span className={cx("absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-white shadow-soft transition-all duration-300", role === "shipper" ? "right-1" : "right-[calc(50%)]")} />
      {(["shipper", "driver"] as Role[]).map((r) => (
        <button key={r} role="tab" aria-selected={role === r}
          onClick={() => { switchRole(r); toast(r === "driver" ? "حالت راننده فعال شد" : "حالت صاحب بار فعال شد", "info"); router.push(`/${r}/`); }}
          className={cx("relative z-10 flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 transition-colors", role === r ? "text-ink" : "text-ink-3")}>
          {r === "shipper" ? "صاحب بار" : "راننده"}
        </button>
      ))}
    </div>
  );
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

export function OrderCard({
  v, href, net, footer, selected, onClick, delay = 0, hideOpenStatus, extra,
}: {
  v: OrderView; href?: string; net?: number; footer?: React.ReactNode; selected?: boolean; onClick?: () => void; delay?: number;
  /** Drop the status badge when it says "open" (redundant in an open-loads list). */
  hideOpenStatus?: boolean; extra?: React.ReactNode;
}) {
  const showStatus = !(hideOpenStatus && v.status === "OPEN");
  const detailed = v.level !== "guest";
  const body = (
    <Card
      className={cx("flex h-full animate-rise flex-col p-4 transition hover:shadow-lift", selected && "ring-2 ring-accent-600")}
      style={{ animationDelay: `${Math.min(delay, 8) * 40}ms` }}
    >
      <div className="mb-3 flex min-h-7 items-center justify-between gap-2">
        {showStatus ? <StatusBadge status={v.status} /> : <span className="text-xs font-bold text-ink-3">{v.level !== "guest" && v.distanceKm ? `${fa(v.distanceKm)} کیلومتر` : ""}</span>}
        {detailed && <span className="text-end text-[13px] text-ink-3">{v.level === "full" && v.groupSize > 1 ? `خودروی ${fa(v.groupIndex)} از ${fa(v.groupSize)} · ` : ""}{windowLabel(v.pickupAt, v.pickupTo)}</span>}
      </div>
      <RouteLine
        from={v.originCity}
        to={v.destCity}
        sub={v.level === "full" ? [v.origin.address, v.dest.address] : v.level === "public" ? ["محدوده‌ی تقریبی بارگیری", `تحویل تا ${jShort(v.deliverBy)}، ${new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(v.deliverBy)}`] : undefined}
      />
      {detailed && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Chip2 icon={<CargoIcon type={v.cargo} />}>{CARGO[v.cargo].label}</Chip2>
          <TempChip min={v.tempMin} max={v.tempMax} />
          <Chip2 icon={<Weight className="size-3.5" aria-hidden />}>{weightLabel(v.weightKg)}</Chip2>
          <Chip2 icon={<Truck className="size-3.5" aria-hidden />}>{VEHICLE_SHORT[v.vehicleType]}</Chip2>
          <Chip2 icon={<Wallet className="size-3.5" aria-hidden />}>{payLabel(v.payment)}</Chip2>
        </div>
      )}
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-line pt-3" style={{ marginTop: "auto" }}>
        {v.level === "guest" ? (
          <div>
            <div className="text-xs text-ink-3">بازه‌ی تقریبی کرایه</div>
            <div className="font-black tabular">{fa(v.priceRange[0] / 1e6)} تا {fa(v.priceRange[1] / 1e6)} میلیون تومان</div>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              {v.level === "public" && <RatingPill r={v.shipperRating} />}
              {extra}
            </div>
            <div className="text-end">
              <div className="text-[11px] text-ink-3">{net !== undefined ? "سهم شما" : v.level === "full" ? "کرایه" : "کرایه"}</div>
              <div className="whitespace-nowrap font-black tabular">{toman(net ?? v.price)}</div>
            </div>
          </>
        )}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </Card>
  );
  if (href) return <Link href={href} className="block h-full">{body}</Link>;
  if (onClick) return <button onClick={onClick} className="block h-full w-full text-start">{body}</button>;
  return body;
}

export function OrderCardSkeleton() {
  return (
    <Card className="space-y-3 p-4">
      <div className="skeleton h-6 w-28 rounded-full" />
      <div className="skeleton h-14 w-full rounded-ui" />
      <div className="skeleton h-8 w-full rounded-ui" />
    </Card>
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
  return new Promise((res) => {
    if (!navigator.geolocation) return res(fallback);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(fallback),
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

const CARGO_ICON = { dairy: Milk, meat: Beef, pharma: Pill, icecream: IceCreamCone, other: Package } as const;
export function CargoIcon({ type, className = "size-4" }: { type: CargoType; className?: string }) {
  const I = CARGO_ICON[type];
  return <I className={className} aria-hidden />;
}
export function CargoLabel({ type }: { type: CargoType }) {
  return <span className="inline-flex items-center gap-1.5"><CargoIcon type={type} />{CARGO[type].label}</span>;
}

/** One multi-vehicle order: shared facts once, one row per vehicle underneath. */
export function OrderGroupCard({ items, delay = 0 }: { items: FullView[]; delay?: number }) {
  const v = items[0];
  const byStatus = new Map<OrderStatus, number>();
  items.forEach((i) => byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1));
  return (
    <Card className="flex h-full animate-rise flex-col p-4" style={{ animationDelay: `${Math.min(delay, 8) * 40}ms` }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Badge tone="brand"><Truck className="size-3.5" aria-hidden />سفارش {fa(items.length)} خودرویی</Badge>
        <span className="text-[13px] text-ink-3">{windowLabel(v.pickupAt, v.pickupTo)}</span>
      </div>
      <RouteLine from={v.originCity} to={v.destCity} sub={[v.origin.address, v.dest.address]} />
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Chip2 icon={<CargoIcon type={v.cargo} />}>{CARGO[v.cargo].label}</Chip2>
        <TempChip min={v.tempMin} max={v.tempMax} />
        <Chip2 icon={<Weight className="size-3.5" aria-hidden />}>{weightLabel(v.weightKg)} در هر خودرو</Chip2>
        <Chip2 icon={<Truck className="size-3.5" aria-hidden />}>{VEHICLE_SHORT[v.vehicleType]}</Chip2>
      </div>
      <ul className="mt-4 divide-y divide-line rounded-ui border border-line" aria-label="خودروهای این سفارش">
        {items.map((i) => (
          <li key={i.id}>
            <Link href={`/shipper/order/?id=${i.id}`} className="flex min-h-12 items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-surface-2">
              <span className="font-bold">خودروی {fa(i.groupIndex)}</span>
              <StatusBadge status={i.status} />
              <span className="min-w-0 flex-1 truncate text-ink-3">{i.driver ? i.driver.name : "راننده‌ای تعیین نشده"}</span>
              <ArrowLeft className="size-4 shrink-0 text-ink-3" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-line pt-3" style={{ marginTop: "1rem" }}>
        <span className="text-xs text-ink-3">{[...byStatus].map(([s, n]) => `${fa(n)} ${STATUS[s].label}`).join(" · ")}</span>
        <div className="text-end"><div className="text-[11px] text-ink-3">کرایه‌ی هر خودرو</div><div className="whitespace-nowrap font-black tabular">{toman(v.price)}</div></div>
      </div>
    </Card>
  );
}
