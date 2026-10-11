import { haversine, roadKm } from "../geo";
import type { Order, State } from "../types";
import { ACTIVE_TRIP, driverOf } from "./core";
import { claimBlock, eligibility } from "./drivers";

export interface LatLng { lat: number; lng: number }
export interface RadarHit { o: Order; km: number; fromRoute?: number; towards: boolean; net?: number }

/** Radar only runs when the truck is empty and free: no assigned/active trip, not blocked. */
export function radarBlock(s: State, pid: string): string | null {
  const d = driverOf(s, pid);
  if (!d) return "ابتدا احراز هویت را کامل کنید.";
  const busy = s.orders.find((o) => o.driverId === pid && ACTIVE_TRIP.includes(o.status));
  if (busy) return "با بار یا سفر فعال، رادار خاموش است تا حواستان پرت نشود.";
  return claimBlock(s, d);
}

/** Distance (km) from a point to the segment a→b (equirectangular approximation, fine at country scale). */
export function distToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const X = (q: LatLng) => ({ x: q.lng * k * 111.32, y: q.lat * 110.57 });
  const P = X(p), A = X(a), B = X(b);
  const dx = B.x - A.x, dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2));
  return Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy));
}

/**
 * Loads for an empty truck at `pos`.
 * - nearby mode: origin within `radiusKm` of the driver
 * - route mode (`dest` given): origin within `corridorKm` of the line pos→dest and the load must head the same way (its destination is closer to `dest` than its origin is)
 */
export function radarLoads(s: State, pid: string, pos: LatLng, opt: { radiusKm: number; dest?: LatLng; corridorKm?: number }): RadarHit[] {
  const d = driverOf(s, pid);
  if (!d) return [];
  const out: RadarHit[] = [];
  for (const o of s.orders) {
    if (!(o.status === "OPEN" || o.status === "PRO_POOL")) continue;
    if (!eligibility(s, d, o).ok) continue;
    const km = haversine(pos.lat, pos.lng, o.origin.lat, o.origin.lng);
    if (opt.dest) {
      const off = distToSegment(o.origin, pos, opt.dest);
      const towards = haversine(o.dest.lat, o.dest.lng, opt.dest.lat, opt.dest.lng) < haversine(o.origin.lat, o.origin.lng, opt.dest.lat, opt.dest.lng);
      if (off > (opt.corridorKm ?? 25) || !towards) continue;
      out.push({ o, km: Math.round(km), fromRoute: Math.round(off), towards });
    } else if (km <= opt.radiusKm) out.push({ o, km: Math.round(km), towards: true });
  }
  return out.sort((a, b) => a.km - b.km).slice(0, 30);
}

export const kmRoad = (a: LatLng, b: LatLng) => roadKm(a, b);
