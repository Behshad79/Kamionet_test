import { R } from "./money";
import { VEHICLES } from "./vehicles";
import type { CargoMode, Rial, State, VehicleKind } from "./types";

export interface RateQuote { min: Rial; max: Rial; source: "table" | "estimate"; km: number }

const round = (n: number) => Math.max(500_000, Math.round(n / 1_000_000) * 1_000_000);

/**
 * Rate provider contract: the seeded table is v1; swap this function for an API-backed
 * one without touching call sites. `km` is computed once from the real coordinates.
 */
export function suggestRate(s: Pick<State, "rates">, from: string, to: string, km: number, kind: VehicleKind, frozen: boolean, mode: CargoMode): RateQuote {
  const hit = s.rates.find((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from));
  const k = VEHICLES[kind].priceFactor * (frozen ? 1.1 : 1) * (mode === "AMBIENT" ? 0.85 : 1);
  if (hit) return { min: round(hit.min * k), max: round(hit.max * k), source: "table", km };
  const perKm = [R(3_400), R(4_600)];
  const kk = Math.max(km, 60);
  return { min: round(perKm[0] * kk * k), max: round(perKm[1] * kk * k), source: "estimate", km };
}
