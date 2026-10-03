import type { OdorClass, Silhouette, VehicleKind } from "./types";

export interface VehicleMeta {
  kind: VehicleKind;
  label: string;
  short: string;
  silhouette: Silhouette;
  /** Default payload in kg; drivers can correct it. */
  capacityKg: number;
  /** Price level versus the 10-ton reference. */
  priceFactor: number;
  fridge: boolean;
  models?: { id: string; label: string }[];
}

export const VEHICLES: Record<VehicleKind, VehicleMeta> = {
  pickup: { kind: "pickup", label: "وانت یخچال‌دار", short: "وانت", silhouette: "pickup", capacityKg: 900, priceFactor: 0.4, fridge: true, models: [{ id: "pride", label: "پراید" }, { id: "zamyad", label: "زامیاد" }, { id: "mazda", label: "مزدا" }] },
  nissan: { kind: "nissan", label: "نیسان یخچال‌دار", short: "نیسان", silhouette: "pickup", capacityKg: 1500, priceFactor: 0.5, fridge: true },
  kamionet: { kind: "kamionet", label: "کامیونت یخچال‌دار", short: "کامیونت", silhouette: "small", capacityKg: 3000, priceFactor: 0.65, fridge: true },
  khavar: { kind: "khavar", label: "خاور (۴ تا ۶ تن)", short: "خاور", silhouette: "mid", capacityKg: 5000, priceFactor: 0.78, fridge: true },
  truck10: { kind: "truck10", label: "کامیون ۱۰ تن (تک)", short: "کامیون ۱۰ تن", silhouette: "heavy", capacityKg: 10000, priceFactor: 1, fridge: true },
  dahcharkh: { kind: "dahcharkh", label: "کامیون ده‌چرخ", short: "ده‌چرخ", silhouette: "heavy", capacityKg: 18000, priceFactor: 1.3, fridge: true },
  trailer: { kind: "trailer", label: "تریلی یخچال‌دار", short: "تریلی", silhouette: "trailer", capacityKg: 24000, priceFactor: 1.6, fridge: true },
  dry: { kind: "dry", label: "کامیون سرپوشیده/کفی (بار غیریخچالی)", short: "سرپوشیده/کفی", silhouette: "heavy", capacityKg: 12000, priceFactor: 0.85, fridge: false },
};

export const VEHICLE_KINDS = Object.keys(VEHICLES) as VehicleKind[];
export const vehicleLabel = (k: VehicleKind) => VEHICLES[k].label;
export const vehicleShort = (k: VehicleKind) => VEHICLES[k].short;

export const VEHICLE_COLORS: { id: string; label: string; hex: string }[] = [
  { id: "white", label: "سفید", hex: "#F3F4F6" },
  { id: "blue", label: "آبی", hex: "#2563EB" },
  { id: "navy", label: "سرمه‌ای", hex: "#1E3A8A" },
  { id: "red", label: "قرمز", hex: "#DC2626" },
  { id: "green", label: "سبز", hex: "#15803D" },
  { id: "yellow", label: "زرد", hex: "#F5B100" },
  { id: "orange", label: "نارنجی", hex: "#EA580C" },
  { id: "silver", label: "نقره‌ای", hex: "#9CA3AF" },
  { id: "black", label: "مشکی", hex: "#1F2937" },
];

/**
 * Letters commonly seen on Iranian plates. NOT an official table: the series
 * a goods vehicle must carry is unverified (see DECISIONS.md #12).
 */
export const PLATE_LETTERS = ["الف", "ب", "پ", "ت", "ث", "ج", "د", "ز", "س", "ش", "ص", "ط", "ع", "ف", "ق", "ک", "گ", "ل", "م", "ن", "و", "ه", "ی"];

export const ODOR_LABEL: Record<OdorClass, string> = { NONE: "بدون بو", LOW: "بوی کم", STRONG: "بوی شدید" };
