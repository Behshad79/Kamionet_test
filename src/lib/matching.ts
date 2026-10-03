import { VEHICLES } from "./vehicles";
import type { CargoMode, Vehicle, VehicleKind } from "./types";

/**
 * Matching rules.
 *  • REFRIGERATED: the truck must be the requested kind, have the payload, and its
 *    fridge must reach the ceiling:  vehicle.min_temp <= order.tempMax.
 *    (A −20° freezer serves chilled cargo; a 0° chiller can't serve −18° frozen.)
 *  • AMBIENT: any vehicle that can run without refrigeration (reefer with the unit
 *    off, or a dry truck) with enough payload. This is what unlocks backhaul.
 */
export type MatchFail = "TEMP" | "TYPE" | "CAPACITY" | "FRIDGE" | "AMBIENT";

export const canCarry = (vehicleMinTemp: number, orderTempMax: number) => vehicleMinTemp <= orderTempMax;

export interface MatchSubject {
  cargoMode: CargoMode;
  tempMax?: number;
  vehicleKind: VehicleKind;
  weightKg: number;
}

export function matchVehicle(v: Vehicle, o: MatchSubject): { ok: true } | { ok: false; why: MatchFail } {
  if (v.capacityKg < o.weightKg) return { ok: false, why: "CAPACITY" };
  if (o.cargoMode === "AMBIENT") {
    return v.canRunAmbient || !VEHICLES[v.kind].fridge ? { ok: true } : { ok: false, why: "AMBIENT" };
  }
  if (v.minTemp === null) return { ok: false, why: "FRIDGE" };
  if (v.kind !== o.vehicleKind) return { ok: false, why: "TYPE" };
  if (o.tempMax !== undefined && !canCarry(v.minTemp, o.tempMax)) return { ok: false, why: "TEMP" };
  return { ok: true };
}

export const MATCH_FAIL_TEXT: Record<MatchFail, string> = {
  TEMP: "یخچال خودروی شما دمای موردنیاز این بار را پشتیبانی نمی‌کند.",
  TYPE: "نوع خودروی شما با خودروی درخواستی صاحب بار یکی نیست.",
  CAPACITY: "ظرفیت خودروی شما برای وزن این بار کافی نیست.",
  FRIDGE: "خودروی شما یخچال ندارد و این بار نیاز به کنترل دما دارد.",
  AMBIENT: "این بار غیریخچالی است و خودروی شما برای حمل بدون یخچال تنظیم نشده است.",
};
