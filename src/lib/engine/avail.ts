import { matchVehicle } from "../matching";
import type { Availability, CargoKind, Order, OrderInput, PayTerms, Rial, State } from "../types";
import { DAY, HOUR, MIN, driverOf, fail, notify, now, ok, person, uid, type Result } from "./core";
import { claimBlock } from "./drivers";
import { claimOrder, confirmAssign } from "./orders";
import { driverStats } from "./stats";

export type AvailInput = Omit<Availability, "id" | "driverId" | "active" | "createdAt">;

export function announce(s: State, driverId: string, a: AvailInput): Result<{ id: string }> {
  const d = driverOf(s, driverId);
  if (!d) return fail("حساب راننده پیدا نشد.");
  const block = claimBlock(s, d);
  if (block) return fail(block);
  if (!a.from) return fail("شهر مبدأ را مشخص کنید.");
  if (a.until <= a.fromAt || a.until <= now(s)) return fail("بازه‌ی آزادبودن معتبر نیست.");
  if (a.minFreight < 0) return fail("مبلغ معتبر نیست.");
  const id = uid(s, "av");
  s.availabilities.unshift({ id, driverId, ...a, to: a.to.filter(Boolean), active: true, createdAt: now(s) });
  return ok({ id });
}

export function cancelAvailability(s: State, driverId: string, id: string): Result {
  const a = s.availabilities.find((x) => x.id === id && x.driverId === driverId);
  if (!a) return fail("مسیر پیدا نشد.");
  a.active = false;
  return ok();
}

export const liveAvailabilities = (s: State) => s.availabilities.filter((a) => a.active && a.until > now(s));

type Probe = Pick<OrderInput, "pickupAt" | "vehicleKind" | "weightKg" | "cargoMode" | "tempMin" | "tempMax"> & { originCity: string; destCity: string; freight?: Rial; shipperId?: string; cargo?: CargoKind; terms?: PayTerms };

/** Why this announcement does NOT fit this (draft) order, in plain Persian. Empty = fits. Route, window, price range, load size, cargo kind/mode, payment terms and the truck itself. */
export function fitReasons(s: State, a: Availability, p: Probe): string[] {
  const d = driverOf(s, a.driverId);
  if (!d || d.personId === p.shipperId || claimBlock(s, d)) return ["راننده در حال حاضر قابل درخواست نیست."];
  const r: string[] = [];
  if (a.from !== p.originCity) r.push(`مبدأ راننده ${a.from} است، نه ${p.originCity}.`);
  if (a.to.length > 0 && !a.to.includes(p.destCity)) r.push(`راننده فقط به ${a.to.join("، ")} می‌رود.`);
  if (p.pickupAt < a.fromAt - 2 * HOUR || p.pickupAt > a.until) r.push("زمان بارگیری خارج از بازه‌ی آزادبودن راننده است.");
  if (p.freight !== undefined && p.freight > 0 && p.freight < a.minFreight) r.push("کرایه‌ی بار کمتر از حداقل مبلغ راننده است.");
  if (p.freight !== undefined && p.freight > 0 && a.maxFreight && p.freight > a.maxFreight) r.push("کرایه‌ی بار بیشتر از بازه‌ی مبلغ راننده است.");
  if (p.weightKg > 0 && a.minWeightKg && p.weightKg < a.minWeightKg) r.push("وزن بار کمتر از حداقل بار راننده است.");
  if (p.weightKg > 0 && a.maxWeightKg && p.weightKg > a.maxWeightKg) r.push("وزن بار بیشتر از حداکثر بار راننده است.");
  if (a.cargoMode && a.cargoMode !== "BOTH" && a.cargoMode !== p.cargoMode) r.push("نوع حمل (یخچالی/معمولی) با شرط راننده نمی‌خواند.");
  if (p.cargo && a.cargoKinds?.length && !a.cargoKinds.includes(p.cargo)) r.push("نوع کالا جزو کالاهای موردقبول راننده نیست.");
  if (p.terms && a.terms?.length && !a.terms.includes(p.terms)) r.push("شرایط پرداخت سفارش با شرط راننده نمی‌خواند.");
  const m = matchVehicle(d.vehicle, { vehicleKind: p.vehicleKind, tempMin: p.tempMin, tempMax: p.tempMax, weightKg: p.weightKg, cargoMode: p.cargoMode } as never);
  if (!m.ok) r.push(m.why === "CAPACITY" ? "ظرفیت خودروی راننده کمتر از وزن بار است." : "نوع یا دمای خودروی راننده با بار نمی‌خواند.");
  return r;
}

export const announcementFits = (s: State, a: Availability, p: Probe) => fitReasons(s, a, p).length === 0;

/** Free drivers that fit this (draft) order. Sensor-linked and better-rated first. */
export function suggestFree(s: State, p: Probe): { a: Availability; score: number }[] {
  const out: { a: Availability; score: number }[] = [];
  for (const a of liveAvailabilities(s)) {
    if (!announcementFits(s, a, p)) continue;
    const d = driverOf(s, a.driverId)!;
    const st = driverStats(s, a.driverId);
    out.push({ a, score: st.rating * 10 + (d.vehicle.thermo?.connected ? 6 : 0) + (d.pro.status === "pro" ? 4 : 0) });
  }
  return out.sort((x, y) => y.score - x.score);
}

/** Open loads that fit any of this driver's live announcements (the single «suggested for me» list; direct requests are merged in by the caller). */
export function loadsForMe(s: State, pid: string): Order[] {
  const mine = liveAvailabilities(s).filter((a) => a.driverId === pid);
  if (!mine.length) return [];
  return s.orders.filter((o) => (o.status === "OPEN" || o.status === "PRO_POOL") && mine.some((a) => announcementFits(s, a, probeOf(o))));
}

/** Shipper picks a free driver for an already-published open order → a direct request to that driver. */
export function requestFreeDriver(s: State, shipperId: string, orderId: string, driverId: string): Result {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o || o.shipperId !== shipperId || o.status !== "OPEN") return fail("این سفارش دیگر قابل ارسال به راننده‌ی آزاد نیست.");
  if (!suggestFree(s, probeOf(o)).some((x) => x.a.driverId === driverId)) return fail("این راننده دیگر با شرایط سفارش نمی‌خواند.");
  o.assignMode = "DIRECT";
  o.directDriverId = driverId;
  o.status = "DIRECT_REQUESTED";
  o.directExpiresAt = now(s) + 10 * MIN;
  notify(s, driverId, "driver", "direct", `صاحب بار شما را برای بار ${o.origin.city} ← ${o.dest.city} انتخاب کرد؛ ۱۰ دقیقه فرصت پاسخ دارید.`, `/driver/order/?id=${o.id}`);
  return ok();
}

export const probeOf = (o: Order): Probe => ({ cargo: o.cargo, terms: o.terms, originCity: o.origin.city, destCity: o.dest.city, pickupAt: o.pickupAt, vehicleKind: o.vehicleKind, weightKg: o.weightKg, cargoMode: o.cargoMode, tempMin: o.tempMin, tempMax: o.tempMax, freight: o.freight, shipperId: o.shipperId });

/** Runs right after an order is published: auto-assign to a driver who accepts automatically, and tell other matching free drivers. */
export function matchOnCreate(s: State, o: Order, auto: boolean) {
  if (o.status !== "OPEN") return;
  const hits = suggestFree(s, probeOf(o));
  if (auto) {
    const pick = hits.find((h) => h.a.acceptAuto);
    if (pick) {
      const c = claimOrder(s, pick.a.driverId, o.id);
      if (c.ok && confirmAssign(s, pick.a.driverId, o.id).ok) {
        notify(s, o.shipperId, "shipper", "auto_matched", `راننده‌ی آزاد ${person(s, pick.a.driverId)?.name ?? ""} بار شما را خودکار پذیرفت؛ بیعانه را بپردازید.`, `/app/order/?id=${o.id}`);
        return;
      }
    }
  }
  for (const h of hits.slice(0, 8)) notify(s, h.a.driverId, "driver", "new_order", `بار مناسبِ آزادی شما ثبت شد: ${o.origin.city} ← ${o.dest.city}`, `/driver/order/?id=${o.id}`);
}

/** Average minutes from «on my way» to pickup, and hours of the loaded leg, from the order event log. */
export function driverTimes(s: State, pid: string) {
  const toPick: number[] = [];
  const leg: number[] = [];
  for (const o of s.orders) {
    if (o.driverId !== pid) continue;
    const at = (st: string) => o.events.find((e) => e.to === st)?.at;
    const a = at("EN_ROUTE_TO_PICKUP"), b = at("AT_PICKUP"), c = at("IN_TRANSIT"), d = at("AT_DELIVERY");
    if (a && b && b > a) toPick.push((b - a) / MIN);
    if (c && d && d > c) leg.push((d - c) / HOUR);
  }
  const avg = (x: number[]) => (x.length ? x.reduce((n, v) => n + v, 0) / x.length : undefined);
  return { toPickupMin: avg(toPick), legHours: avg(leg), n: toPick.length };
}
void DAY;
