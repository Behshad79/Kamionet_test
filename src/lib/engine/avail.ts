import { matchVehicle } from "../matching";
import type { Availability, Order, OrderInput, Rial, State } from "../types";
import { DAY, HOUR, MIN, driverOf, fail, notify, now, ok, person, uid, type Result } from "./core";
import { claimBlock } from "./drivers";
import { claimOrder, confirmAssign } from "./orders";
import { driverStats } from "./stats";

export interface AvailInput { from: string; to: string[]; fromAt: number; until: number; minFreight: Rial; note: string; acceptAuto: boolean }

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
  if (!a) return fail("اعلام آزادی پیدا نشد.");
  a.active = false;
  return ok();
}

export const liveAvailabilities = (s: State) => s.availabilities.filter((a) => a.active && a.until > now(s));

type Probe = Pick<OrderInput, "pickupAt" | "vehicleKind" | "weightKg" | "cargoMode" | "tempMin" | "tempMax"> & { originCity: string; destCity: string; freight?: Rial; shipperId?: string };

/** Free drivers that fit this (draft) order: route, window, price floor and truck. Sensor-linked and better-rated first. */
export function suggestFree(s: State, p: Probe): { a: Availability; score: number }[] {
  const out: { a: Availability; score: number }[] = [];
  for (const a of liveAvailabilities(s)) {
    const d = driverOf(s, a.driverId);
    if (!d || d.personId === p.shipperId || claimBlock(s, d)) continue;
    if (a.from !== p.originCity || (a.to.length > 0 && !a.to.includes(p.destCity))) continue;
    if (p.pickupAt < a.fromAt - 2 * HOUR || p.pickupAt > a.until) continue;
    if (p.freight !== undefined && p.freight > 0 && p.freight < a.minFreight) continue;
    if (!matchVehicle(d.vehicle, { vehicleKind: p.vehicleKind, tempMin: p.tempMin, tempMax: p.tempMax, weightKg: p.weightKg, cargoMode: p.cargoMode } as never).ok) continue;
    const st = driverStats(s, a.driverId);
    out.push({ a, score: st.rating * 10 + (d.vehicle.thermo?.connected ? 6 : 0) + (d.pro.status === "pro" ? 4 : 0) });
  }
  return out.sort((x, y) => y.score - x.score);
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

export const probeOf = (o: Order): Probe => ({ originCity: o.origin.city, destCity: o.dest.city, pickupAt: o.pickupAt, vehicleKind: o.vehicleKind, weightKg: o.weightKg, cargoMode: o.cargoMode, tempMin: o.tempMin, tempMax: o.tempMax, freight: o.freight, shipperId: o.shipperId });

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
