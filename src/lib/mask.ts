import { approxArea, roadKm } from "./geo";
import type { DriverProfile, FullView, GuestView, Order, OrderView, PublicView, State } from "./types";

/**
 * The only door between raw orders and the UI. Components never receive an
 * `Order`; they receive a view whose shape already excludes what the viewer
 * must not see (mirrors the RPC/View boundary planned for Postgres).
 *
 *  guest            → cities + rounded price range
 *  public (verified or not) → fuzzy area, no names/phones/exact address
 *  full             → the shipper, or the driver once ASSIGNED
 */
const FULL_STATUSES = new Set(["ASSIGNED", "IN_TRANSIT", "DELIVERED"]);

export function guestView(o: Order): GuestView {
  const step = 1_000_000;
  return {
    level: "guest",
    id: o.id,
    status: o.status,
    originCity: o.origin.city,
    destCity: o.dest.city,
    priceRange: [Math.floor((o.price * 0.9) / step) * step, Math.ceil((o.price * 1.1) / step) * step],
  };
}

export function publicView(o: Order, viewerId?: string): PublicView {
  return {
    level: "public",
    id: o.id,
    status: o.status,
    originCity: o.origin.city,
    destCity: o.dest.city,
    originArea: approxArea(o.origin, o.id),
    destArea: approxArea(o.dest, o.id + "d"),
    distanceKm: roadKm(o.origin, o.dest),
    pickupAt: o.pickupAt,
    cargo: o.cargo,
    tempMax: o.tempMax,
    price: o.price,
    insurance: o.insurance,
    lockedUntil: o.status === "LOCKED" ? o.lockedUntil : undefined,
    lockedByMe: !!viewerId && o.lockedBy === viewerId,
  };
}

export function fullView(o: Order, s: State): FullView {
  const shipper = s.users.find((u) => u.id === o.shipperId);
  const driver = o.driverId ? s.users.find((u) => u.id === o.driverId) : undefined;
  const dp: DriverProfile | undefined = o.driverId ? s.drivers.find((d) => d.userId === o.driverId) : undefined;
  const { level: _l, ...pub } = publicView(o, o.driverId);
  void _l;
  return {
    ...pub,
    level: "full",
    origin: o.origin,
    dest: o.dest,
    shipper: { name: shipper?.name ?? "—", phone: shipper?.phone ?? "—" },
    driver: driver ? { name: driver.name, phone: driver.phone, plate: dp?.vehicle.plate } : undefined,
    waybillNo: o.waybillNo,
    media: o.media,
    flag: o.flag,
    startedAt: o.startedAt,
    deliveredAt: o.deliveredAt,
    assignedAt: o.assignedAt,
    note: o.note,
    groupSize: o.groupSize,
    groupIndex: o.groupIndex,
  };
}

export function viewOrder(o: Order, s: State): OrderView {
  const uid = s.session.userId;
  if (!uid) return guestView(o);
  if (o.shipperId === uid) return fullView(o, s);
  if (o.driverId === uid && FULL_STATUSES.has(o.status)) return fullView(o, s);
  return publicView(o, uid);
}

export const isFull = (v: OrderView): v is FullView => v.level === "full";
export const isPublic = (v: OrderView): v is PublicView => v.level === "public";
