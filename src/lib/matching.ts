import type { DriverProfile, DocKey, Vehicle, VehicleType } from "./types";
import { daysUntil } from "./format";

/**
 * Temperature capacity matching:
 *   vehicle.min_temp_capacity <= order.required_temp_max
 * A −20° freezer truck serves +4° chilled orders too; a 0° chiller can't
 * serve −18° frozen orders.
 */
export const canCarry = (vehicleMinTemp: number, orderTempMax: number) => vehicleMinTemp <= orderTempMax;

export type MatchFail = "TEMP" | "TYPE" | "CAPACITY";

/**
 * Full match: temperature alone is never enough. The truck must also be the
 * class the shipper asked for and have the payload for the cargo weight.
 */
export function matchVehicle(v: Vehicle, o: { tempMax: number; vehicleType: VehicleType; weightKg: number }): { ok: true } | { ok: false; why: MatchFail } {
  if (v.type !== o.vehicleType) return { ok: false, why: "TYPE" };
  if (v.capacityKg < o.weightKg) return { ok: false, why: "CAPACITY" };
  if (!canCarry(v.minTemp, o.tempMax)) return { ok: false, why: "TEMP" };
  return { ok: true };
}

export const MATCH_FAIL_TEXT: Record<MatchFail, string> = {
  TEMP: "یخچال خودروی شما دمای موردنیاز این بار را پشتیبانی نمی‌کند.",
  TYPE: "نوع خودروی شما با خودروی درخواستی صاحب بار یکی نیست.",
  CAPACITY: "ظرفیت خودروی شما برای وزن این بار کافی نیست.",
};

export type DriverStanding = "none" | "draft" | "pending" | "rejected" | "verified" | "suspended";

const EXPIRING: DocKey[] = ["insurance", "inspection"];

export function expiryStatus(p: DriverProfile | undefined, now = Date.now()) {
  const items = EXPIRING.map((k) => {
    const t = p?.docs[k]?.expiresAt;
    return {
      key: k,
      label: k === "insurance" ? "بیمه شخص ثالث" : "معاینه فنی",
      expiresAt: t,
      days: t ? daysUntil(t, now) : undefined,
    };
  });
  const expired = items.filter((i) => i.days !== undefined && i.days < 0);
  const soon = items.filter((i) => i.days !== undefined && i.days >= 0 && i.days <= 30);
  return { items, expired, soon };
}

/** Verified drivers whose insurance / inspection lapsed are suspended automatically. */
export function standing(p: DriverProfile | undefined, now = Date.now()): DriverStanding {
  if (!p) return "none";
  if (p.kyc === "verified" && expiryStatus(p, now).expired.length) return "suspended";
  return p.kyc;
}

export const canClaim = (p: DriverProfile | undefined) => standing(p) === "verified";
