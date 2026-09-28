import type { Area, Place } from "./types";

export const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "تهران", lat: 35.6892, lng: 51.389 },
  { name: "کرج", lat: 35.8327, lng: 50.9915 },
  { name: "مشهد", lat: 36.2605, lng: 59.6168 },
  { name: "اصفهان", lat: 32.6546, lng: 51.668 },
  { name: "شیراز", lat: 29.5918, lng: 52.5837 },
  { name: "تبریز", lat: 38.08, lng: 46.2919 },
  { name: "اهواز", lat: 31.3183, lng: 48.6706 },
  { name: "قم", lat: 34.6416, lng: 50.8746 },
  { name: "کرمانشاه", lat: 34.3277, lng: 47.0778 },
  { name: "ارومیه", lat: 37.5527, lng: 45.0761 },
  { name: "رشت", lat: 37.2808, lng: 49.5832 },
  { name: "زاهدان", lat: 29.4963, lng: 60.8629 },
  { name: "کرمان", lat: 30.2839, lng: 57.0834 },
  { name: "همدان", lat: 34.7992, lng: 48.5146 },
  { name: "یزد", lat: 31.8974, lng: 54.3569 },
  { name: "اردبیل", lat: 38.2498, lng: 48.2933 },
  { name: "بندرعباس", lat: 27.1865, lng: 56.2808 },
  { name: "اراک", lat: 34.0917, lng: 49.6892 },
  { name: "ساری", lat: 36.5633, lng: 53.0601 },
  { name: "گرگان", lat: 36.8427, lng: 54.4439 },
  { name: "قزوین", lat: 36.2688, lng: 50.0041 },
  { name: "سمنان", lat: 35.5769, lng: 53.3921 },
  { name: "بوشهر", lat: 28.9234, lng: 50.8203 },
  { name: "زنجان", lat: 36.6765, lng: 48.4963 },
  { name: "سنندج", lat: 35.3219, lng: 46.9862 },
  { name: "خرم‌آباد", lat: 33.4878, lng: 48.3558 },
];

export const cityByName = (n: string) => CITIES.find((c) => c.name === n) ?? CITIES[0];

export const cityPlace = (name: string, address = ""): Place => {
  const c = cityByName(name);
  return { city: c.name, lat: c.lat, lng: c.lng, address: address || `مرکز ${c.name}` };
};

/** Nearest known city to a coordinate. */
export function nearestCity(lat: number, lng: number) {
  let best = CITIES[0];
  let bd = Infinity;
  for (const c of CITIES) {
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
