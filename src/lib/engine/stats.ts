import type { Order, Review, State } from "../types";
import { driverOf, shipperOf } from "./core";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const DRIVER_CRITERIA = [
  { id: "punctuality", label: "وقت‌شناسی" },
  { id: "cleanliness", label: "نظافت و بو" },
  { id: "coldchain", label: "رعایت زنجیره‌ی سرد" },
  { id: "behavior", label: "رفتار" },
  { id: "communication", label: "ارتباط" },
] as const;

export const SHIPPER_CRITERIA = [
  { id: "honesty", label: "اظهار صادقانه‌ی بار" },
  { id: "loading", label: "سرعت بارگیری" },
  { id: "behavior", label: "رفتار" },
  { id: "payment", label: "پرداخت" },
] as const;

const visible = (r: Review) => r.revealed && r.moderation !== "hidden";

function criteriaAvg(rs: Review[], ids: readonly { id: string }[]) {
  return Object.fromEntries(ids.map((c) => [c.id, avg(rs.map((r) => r.criteria[c.id]).filter((x) => x !== undefined))]));
}

export interface DriverStats {
  trips: number;
  rating: number;
  ratingCount: number;
  onTime: number;
  cancelRate: number;
  breakdown: Record<string, number>;
  recent: Review[];
  clean: number;
}

export function driverStats(s: State, pid: string): DriverStats {
  const d = driverOf(s, pid);
  const orders = s.orders.filter((o) => o.driverId === pid);
  const done = orders.filter((o) => ["DELIVERED", "COMPLETED"].includes(o.status));
  const rs = s.reviews.filter((r) => r.toId === pid && r.fromRole === "shipper" && visible(r));
  const base = d?.base;
  const w = Math.min(base?.trips ?? 0, 40);
  const rating = (w * (base?.rating ?? 0) + rs.reduce((n, r) => n + r.overall, 0)) / Math.max(1, w + rs.length);
  const timed = done.filter((o) => o.loadedAt && o.deliveredAt);
  const onTimeReal = timed.filter((o) => o.deliveredAt! <= o.deliverBy).length;
  const onTime = (w * (base?.onTime ?? 0) + onTimeReal) / Math.max(1, w + timed.length);
  const cancelled = orders.filter((o) => o.status === "CANCELLED_BY_DRIVER").length + (d?.strikes.filter((x) => x.kind === "cancel").length ?? 0);
  const breakdown = criteriaAvg(rs, DRIVER_CRITERIA);
  for (const c of DRIVER_CRITERIA) if (!breakdown[c.id]) breakdown[c.id] = base?.rating ?? 0;
  return {
    trips: (base?.trips ?? 0) + done.length,
    rating: rating || base?.rating || 0,
    ratingCount: rs.length + (base ? Math.round(base.trips * 0.6) : 0),
    onTime,
    cancelRate: cancelled / Math.max(1, orders.length + (base?.trips ?? 0)),
    breakdown,
    recent: rs.sort((a, b) => b.at - a.at).slice(0, 8),
    clean: d?.clean.score ?? 0,
  };
}

export interface ShipperStats {
  shipments: number;
  rating: number;
  ratingCount: number;
  onTimeLoading: number;
  cancelRate: number;
  paymentPunctuality: number;
  breakdown: Record<string, number>;
  recent: Review[];
  honesty: number;
}

export function shipperStats(s: State, pid: string): ShipperStats {
  const sp = shipperOf(s, pid);
  const orders = s.orders.filter((o) => o.shipperId === pid);
  const done = orders.filter((o) => ["DELIVERED", "COMPLETED"].includes(o.status));
  const cancelled = orders.filter((o) => o.status === "CANCELLED_BY_SHIPPER").length;
  const rs = s.reviews.filter((r) => r.toId === pid && r.fromRole === "driver" && visible(r));
  const loaded = done.filter((o) => o.arrivedPickupAt && o.loadedAt);
  const fast = loaded.filter((o) => (o.loadedAt! - o.arrivedPickupAt!) <= 60 * 60_000).length;
  const extra = baseFor(sp?.memberSince ?? 0, pid);
  const breakdown = criteriaAvg(rs, SHIPPER_CRITERIA);
  const r0 = extra.rating;
  for (const c of SHIPPER_CRITERIA) if (!breakdown[c.id]) breakdown[c.id] = r0;
  const rating = (extra.n * r0 + rs.reduce((n, r) => n + r.overall, 0)) / Math.max(1, extra.n + rs.length);
  return {
    shipments: extra.shipments + done.length,
    rating: rating || r0,
    ratingCount: rs.length + extra.n,
    onTimeLoading: (extra.n * extra.onTime + fast) / Math.max(1, extra.n + loaded.length),
    cancelRate: (cancelled + extra.cancels) / Math.max(1, orders.length + extra.shipments),
    paymentPunctuality: extra.pay,
    breakdown,
    recent: rs.sort((a, b) => b.at - a.at).slice(0, 8),
    honesty: sp?.honesty ?? 100,
  };
}

/** Stable pseudo-history for shippers (seed has no pre-window orders): derived from id so it never changes. */
function baseFor(memberSince: number, pid: string) {
  let h = 0;
  for (const c of pid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = (n: number) => ((h >> n) % 100) / 100;
  const enterprise = memberSince > 0 && r(3) > 0.8;
  const shipments = Math.round(12 + r(1) * 60 + (enterprise ? 150 : 0));
  return { shipments, n: Math.round(shipments * 0.5), rating: 4.1 + r(5) * 0.8, onTime: 0.8 + r(7) * 0.18, cancels: Math.round(shipments * 0.04 * r(9)), pay: 0.9 + r(11) * 0.09 };
}

export const shipperRatingBrief = (s: State, pid: string) => {
  const st = shipperStats(s, pid);
  return { avg: st.rating, count: st.ratingCount };
};

export function ordersOf(s: State, o: Order[]) {
  return o;
}
