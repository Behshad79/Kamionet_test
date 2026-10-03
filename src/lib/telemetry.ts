/**
 * Simulated reefer-unit sensor feed (prototype).
 *
 * Readings are a pure function of (order id, trip start, now), so every screen
 * that shows the same order shows the same series, and a page opened later
 * reconstructs the whole history. In production this is replaced by the
 * telematics ingest table; the shape (`Reading`, `Excursion`) stays.
 */

/** Demo clock: a real 60 km/h trip is replayed this many times faster so a presenter sees movement. */
export const DEMO_SPEEDUP = 30;
const SAMPLES = 40;

export interface Reading {
  at: number;
  c: number;
  out: boolean;
  dir?: "high" | "low";
}

export interface Excursion {
  from: number;
  to: number;
  peak: number;
  dir: "high" | "low";
  ongoing: boolean;
}

export interface TelemetryOrder {
  id: string;
  tempMin?: number;
  tempMax?: number;
  /** Moment the cargo was loaded and the truck started moving. */
  startedAt?: number;
  deliveredAt?: number;
  distanceKm?: number;
  forceExcursionAt?: number;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-noise in [-1, 1]. */
const noise = (seed: number, i: number) => Math.sin(seed * 12.9898 + i * 78.233) * 0.5 + Math.sin(seed * 4.1 + i * 2.7) * 0.5;

/** About one trip in three has a door-open style excursion; the seeded delivered trip always does. */
const hasExcursion = (id: string) => id === "o-seed-done" || hash(id) % 4 === 0;

export function tripDuration(o: TelemetryOrder) {
  if (o.deliveredAt && o.startedAt) return Math.max(60_000, o.deliveredAt - o.startedAt);
  return Math.max(4 * 60_000, ((o.distanceKm ?? 200) / 60) * 3_600_000 / DEMO_SPEEDUP);
}

/** 0 → 1 position along the route. */
export function tripProgress(o: TelemetryOrder, now: number) {
  if (!o.startedAt) return 0;
  if (o.deliveredAt) return 1;
  return Math.min(1, Math.max(0, (now - o.startedAt) / tripDuration(o)));
}

export function readings(o: TelemetryOrder, now: number): Reading[] {
  if (!o.startedAt || o.tempMin === undefined || o.tempMax === undefined) return [];
  const p = tripProgress(o, now);
  const seed = (hash(o.id) % 1000) / 10;
  const mid = (o.tempMin + o.tempMax) / 2;
  const half = Math.max(0.5, (o.tempMax - o.tempMin) / 2);
  const h = hash(o.id);
  const dur = tripDuration(o);
  const forced = o.forceExcursionAt !== undefined;
  const exStart = forced ? Math.max(3, Math.min(SAMPLES - 7, Math.round(((o.forceExcursionAt! - o.startedAt) / dur) * SAMPLES))) : 14 + (h % 9);
  const out: Reading[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    if (i / SAMPLES > p) break;
    let c = mid + Math.sin(i * 0.55 + seed) * half * 0.38 + noise(seed, i) * half * 0.14;
    if ((forced || hasExcursion(o.id)) && i >= exStart && i <= exStart + 5) {
      const k = 1 - Math.abs(i - (exStart + 2.5)) / 3.2; // triangular bump
      c = (o.tempMax as number) + 0.5 + Math.max(0, k) * Math.max(1.6, half * 0.5);
    }
    c = Math.round(c * 10) / 10;
    const high = c > o.tempMax;
    const low = c < o.tempMin;
    out.push({ at: o.startedAt + (i / SAMPLES) * dur, c, out: high || low, dir: high ? "high" : low ? "low" : undefined });
  }
  return out;
}

export function excursions(rs: Reading[]): Excursion[] {
  const list: Excursion[] = [];
  let cur: Excursion | null = null;
  for (const r of rs) {
    if (r.out) {
      if (!cur) cur = { from: r.at, to: r.at, peak: r.c, dir: r.dir!, ongoing: false };
      cur.to = r.at;
      if (r.dir === "high" ? r.c > cur.peak : r.c < cur.peak) cur.peak = r.c;
    } else if (cur) {
      list.push(cur);
      cur = null;
    }
  }
  if (cur) { cur.ongoing = true; list.push(cur); }
  return list;
}

export function stats(rs: Reading[]) {
  if (!rs.length) return undefined;
  const cs = rs.map((r) => r.c);
  return { min: Math.min(...cs), max: Math.max(...cs), avg: cs.reduce((a, b) => a + b, 0) / cs.length };
}
