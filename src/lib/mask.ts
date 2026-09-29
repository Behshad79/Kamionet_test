import { approxArea } from "./geo";
import type { DriverProfile, FullView, GuestView, Order, OrderView, PublicView, Rating, State } from "./types";

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

export function shipperRating(ratings: Rating[], shipperId: string) {
  const r = ratings.filter((x) => x.to === shipperId);
  if (!r.length) return undefined;
  return { avg: r.reduce((n, x) => n + x.stars, 0) / r.length, count: r.length };
}

export function publicView(o: Order, viewerId?: string, ratings: Rating[] = []): PublicView {
  return {
    level: "public",
    id: o.id,
    status: o.status,
    originCity: o.origin.city,
    destCity: o.dest.city,
    originArea: approxArea(o.origin, o.id),
    destArea: approxArea(o.dest, o.id + "d"),
    distanceKm: o.distanceKm,
    pickupAt: o.pickupAt,
    pickupTo: o.pickupTo,
    deliverBy: o.deliverBy,
    cargo: o.cargo,
    tempMin: o.tempMin,
    tempMax: o.tempMax,
    vehicleType: o.vehicleType,
    weightKg: o.weightKg,
    pallets: o.pallets,
    volumeM3: o.volumeM3,
    price: o.price,
    payment: o.payment,
    insurance: o.insurance,
    shipperRating: shipperRating(ratings, o.shipperId),
    lockedUntil: o.status === "LOCKED" ? o.lockedUntil : undefined,
    lockedByMe: !!viewerId && o.lockedBy === viewerId,
  };
}

export function fullView(o: Order, s: State): FullView {
  const shipper = s.users.find((u) => u.id === o.shipperId);
  const driver = o.driverId ? s.users.find((u) => u.id === o.driverId) : undefined;
  const dp: DriverProfile | undefined = o.driverId ? s.drivers.find((d) => d.userId === o.driverId) : undefined;
  const { level: _l, ...pub } = publicView(o, o.driverId, s.ratings);
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
    declaredValue: o.declaredValue,
    cancelFee: o.cancelFee,
    groupId: o.groupId,
    groupSize: o.groupSize,
    groupIndex: o.groupIndex,
  };
}

export function viewOrder(o: Order, s: State): OrderView {
  const uid = s.session.userId;
  if (!uid) return guestView(o);
  if (o.shipperId === uid) return fullView(o, s);
  if (o.driverId === uid && FULL_STATUSES.has(o.status)) return fullView(o, s);
  return publicView(o, uid, s.ratings);
}

export const isFull = (v: OrderView): v is FullView => v.level === "full";
export const isPublic = (v: OrderView): v is PublicView => v.level === "public";
