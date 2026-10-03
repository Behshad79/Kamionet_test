import { approxArea } from "./geo";
import { shipperStats } from "./engine/stats";
import type { FullView, GuestView, Order, OrderView, PublicView, State } from "./types";
import { driverOf, person, shipperOf } from "./engine/core";

/**
 * The only door between raw orders and the UI. Components receive a view whose
 * shape already excludes what the viewer must not see (mirrors the RPC/View
 * boundary planned for Postgres).
 *
 *   guest   → cities + rounded price range
 *   public  → fuzzy areas, shipper's PUBLIC profile (company, rating); no address, phone or exact point
 *   full    → the shipper, or the matched driver once the deposit is paid (ASSIGNED and later)
 */
const FULL_FOR_DRIVER = new Set(["ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "MISMATCH_REVIEW", "IN_TRANSIT", "AT_DELIVERY", "DELIVERED", "COMPLETED", "DISPUTED"]);

export function guestView(o: Order): GuestView {
  const step = 10_000_000; // 1M toman
  return {
    level: "guest", id: o.id, status: o.status, originCity: o.origin.city, destCity: o.dest.city, cargoMode: o.cargoMode,
    priceRange: [Math.floor((o.freight * 0.9) / step) * step, Math.ceil((o.freight * 1.1) / step) * step],
  };
}

export function publicView(o: Order, viewerId: string | undefined, s: State): PublicView {
  const sh = shipperOf(s, o.shipperId);
  const st = shipperStats(s, o.shipperId);
  return {
    level: "public", id: o.id, status: o.status, originCity: o.origin.city, destCity: o.dest.city,
    originArea: approxArea(o.origin, o.id), destArea: approxArea(o.dest, o.id + "d"),
    distanceKm: o.distanceKm, pickupAt: o.pickupAt, pickupTo: o.pickupTo, deliverBy: o.deliverBy,
    cargoMode: o.cargoMode, cargo: o.cargo, odor: o.odor, odorSensitive: o.odorSensitive, tempMin: o.tempMin, tempMax: o.tempMax,
    vehicleKind: o.vehicleKind, weightKg: o.weightKg, pallets: o.pallets, volumeM3: o.volumeM3,
    freight: o.freight, tipPre: o.tipPre, terms: o.terms, insured: !!o.insurance.productId, serviceClass: o.serviceClass, assignMode: o.assignMode, cleanOnly: o.cleanOnly,
    shipper: { id: o.shipperId, name: sh?.displayName ?? person(s, o.shipperId)?.name ?? "—", verified: !!sh?.businessVerified, rating: { avg: st.rating, count: st.ratingCount } },
    lockedUntil: o.status === "LOCKED" ? o.lockedUntil : undefined,
    lockedByMe: !!viewerId && o.lockedBy === viewerId,
    isDirectToMe: !!viewerId && o.directDriverId === viewerId,
    directExpiresAt: o.directDriverId === viewerId ? o.directExpiresAt : undefined,
  };
}

export function fullView(o: Order, s: State): FullView {
  const p = person(s, o.shipperId);
  const dpRow = o.driverId ? person(s, o.driverId) : undefined;
  const dp = driverOf(s, o.driverId);
  const { level: _l, ...pub } = publicView(o, o.driverId, s);
  void _l;
  return {
    ...pub, level: "full", origin: o.origin, dest: o.dest,
    shipperContact: { name: p?.name ?? "—", phone: p?.phone ?? "—" },
    driver: dpRow ? { id: dpRow.id, name: dpRow.name, phone: dpRow.phone, plate: dp?.vehicle.plate ? `${dp.vehicle.plate.two} ${dp.vehicle.plate.letter} ${dp.vehicle.plate.three} ایران ${dp.vehicle.plate.prov}` : undefined, vehicleKind: dp?.vehicle.kind, color: dp?.vehicle.color } : undefined,
    waybills: o.waybills, media: o.media, flag: o.flag, loadedAt: o.loadedAt, departedAt: o.departedAt, deliveredAt: o.deliveredAt, assignedAt: o.assignedAt,
    note: o.note, declaredValue: o.declaredValue, groupId: o.groupId, groupSize: o.groupSize, groupIndex: o.groupIndex, depositDueAt: o.depositDueAt, consigneeToken: o.consignee.token,
  };
}

export function viewOrder(o: Order, s: State, viewerId: string | undefined): OrderView {
  if (!viewerId) return guestView(o);
  if (o.shipperId === viewerId) return fullView(o, s);
  if (o.driverId === viewerId && FULL_FOR_DRIVER.has(o.status)) return fullView(o, s);
  return publicView(o, viewerId, s);
}

export const isFull = (v: OrderView): v is FullView => v.level === "full";
export const isPublic = (v: OrderView): v is PublicView => v.level === "public";
