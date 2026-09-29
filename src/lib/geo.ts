import type { Area, Place } from "./types";

import { PLACES, placeByName } from "./places";

/** Kept for call sites that only need "a place with coordinates". */
export const CITIES = PLACES;

export const cityByName = (n: string) => placeByName(n) ?? PLACES[0];

export const cityPlace = (name: string, address = ""): Place => {
  const c = cityByName(name);
  return { city: c.name, province: c.province, lat: c.lat, lng: c.lng, address };
};

/** Nearest known city (industrial towns excluded) to a coordinate. */
export function nearestCity(lat: number, lng: number) {
  let best = PLACES[0];
  let bd = Infinity;
  for (const c of PLACES) {
    if (c.kind === "industrial") continue;
    const d = haversine(lat, lng, c.lat, c.lng);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Road distance estimate (straight line × winding factor), rounded to 5 km. */
export function roadKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.max(5, Math.round((haversine(a.lat, a.lng, b.lat, b.lng) * 1.28) / 5) * 5);
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic "fuzzy" area used before ASSIGNED. The centre is snapped to a
 * ~4 km grid and offset by a per-order amount, so exact coordinates never
 * reach non-matched viewers. (In production this runs server-side.)
 */
export function approxArea(p: { lat: number; lng: number }, orderId: string): Area {
  const h = hash(orderId + p.lat.toFixed(3));
  const grid = 0.04;
  const jx = ((h % 1000) / 1000 - 0.5) * 0.03;
  const jy = (((h >> 10) % 1000) / 1000 - 0.5) * 0.03;
  return {
    lat: Math.round(p.lat / grid) * grid + jy,
    lng: Math.round(p.lng / grid) * grid + jx,
    radius: 3500,
  };
}

export function lerp(a: { lat: number; lng: number }, b: { lat: number; lng: number }, t: number) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}
