import { roadKm, cityByName } from "./geo";
import type { CargoType, Config, RateEntry } from "./types";

/**
 * Rate provider contract. The seeded table below is the v1 implementation;
 * swap `suggestRate` for an API-backed one without touching call sites.
 */
export interface RateQuote {
  min: number;
  max: number;
  source: "table" | "estimate";
  km: number;
}

const PER_KM: Record<CargoType, [number, number]> = {
  dairy: [34_000, 44_000],
  meat: [38_000, 49_000],
  pharma: [46_000, 60_000],
  icecream: [42_000, 55_000],
  other: [34_000, 46_000],
};

const round = (n: number) => Math.round(n / 500_000) * 500_000 || 500_000;

export function suggestRate(
  rates: RateEntry[],
  from: string,
  to: string,
  cargo: CargoType,
  frozen: boolean,
): RateQuote {
  const a = cityByName(from);
  const b = cityByName(to);
  const km = roadKm(a, b);
  const hit = rates.find((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from));
  const cargoFactor = cargo === "pharma" ? 1.2 : cargo === "meat" ? 1.08 : cargo === "icecream" ? 1.12 : 1;
  const frozenFactor = frozen ? 1.1 : 1;
  if (hit) {
    return { min: round(hit.min * cargoFactor * frozenFactor), max: round(hit.max * cargoFactor * frozenFactor), source: "table", km };
  }
  const [lo, hi] = PER_KM[cargo];
  const f = frozen ? 1.1 : 1;
  return { min: round(km * lo * f), max: round(km * hi * f), source: "estimate", km };
}

export function insuranceFee(price: number, cfg: Config) {
  return Math.round((price * cfg.insuranceRate) / 1000) * 1000;
}

export const driverNet = (price: number, cfg: Config) => Math.round(price * (1 - cfg.commission));
export const platformFee = (price: number, cfg: Config) => Math.round(price * cfg.commission);

export const SEED_RATES: RateEntry[] = [
  { id: "r1", from: "تهران", to: "اصفهان", min: 15_000_000, max: 20_000_000 },
  { id: "r2", from: "تهران", to: "مشهد", min: 32_000_000, max: 42_000_000 },
  { id: "r3", from: "تهران", to: "شیراز", min: 34_000_000, max: 44_000_000 },
  { id: "r4", from: "تهران", to: "تبریز", min: 22_000_000, max: 29_000_000 },
  { id: "r5", from: "تهران", to: "رشت", min: 8_000_000, max: 11_000_000 },
  { id: "r6", from: "تهران", to: "کرج", min: 3_000_000, max: 4_500_000 },
  { id: "r7", from: "اصفهان", to: "شیراز", min: 12_000_000, max: 16_500_000 },
  { id: "r8", from: "مشهد", to: "تبریز", min: 55_000_000, max: 70_000_000 },
  { id: "r9", from: "تهران", to: "اهواز", min: 30_000_000, max: 39_000_000 },
  { id: "r10", from: "تهران", to: "قم", min: 3_500_000, max: 5_000_000 },
];
