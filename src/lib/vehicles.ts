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

/** Typical makes + models per class (the driver can still type any exact model). */
export const MAKES: Record<VehicleKind, { make: string; models: string[] }[]> = {
  pickup: [{ make: "پراید", models: ["۱۵۱ وانت", "۱۳۱ وانت"] }, { make: "زامیاد", models: ["Z24", "Z24 دوکابین"] }, { make: "مزدا", models: ["۲۰۰۰ وانت"] }],
  nissan: [{ make: "زامیاد", models: ["نیسان Z24", "نیسان دیزل"] }, { make: "نیسان", models: ["۲۰۰۰"] }],
  kamionet: [{ make: "ایسوزو", models: ["NHR", "NKR"] }, { make: "کاویان", models: ["۶ تن", "۴ تن"] }, { make: "هیوندای", models: ["HD65", "HD72"] }],
  khavar: [{ make: "ایسوزو", models: ["NPR ۷۵", "NPR ۸۵"] }, { make: "کاویان", models: ["۸ تن"] }, { make: "هیوندای", models: ["HD78"] }],
  truck10: [{ make: "ولوو", models: ["FL", "FM"] }, { make: "مرسدس‌بنز", models: ["آکسور ۱۹۱۸", "۲۶۴۰"] }, { make: "ایسوزو", models: ["FVR"] }],
  dahcharkh: [{ make: "ولوو", models: ["FM ده‌چرخ"] }, { make: "مرسدس‌بنز", models: ["آکتروس"] }, { make: "مان", models: ["TGS"] }],
  trailer: [{ make: "اسکانیا", models: ["R۴۲۰", "G۴۰۰"] }, { make: "ولوو", models: ["FH"] }, { make: "مرسدس‌بنز", models: ["اکتروس ۱۸۴۴"] }],
  dry: [{ make: "ولوو", models: ["FL"] }, { make: "مرسدس‌بنز", models: ["۱۸۳۱"] }, { make: "ایسوزو", models: ["NPR"] }],
};

const nfa = (n: number) => new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(n);
/** «ایسوزو NPR ۷۵ · مدل ۱۴۰۱» (falls back to the class name for older profiles). */
export function vehicleTitle(v: { kind: VehicleKind; make?: string; modelName?: string; year?: number }) {
  const name = [v.make, v.modelName].filter(Boolean).join(" ") || VEHICLES[v.kind].short;
  return v.year ? `${name} · مدل ${nfa(v.year)}` : name;
}

export const THERMO_KINDS = [
  { id: "none", label: "دماسنج ندارم" },
  { id: "analog", label: "دماسنج عقربه‌ای/ساده" },
  { id: "digital", label: "دماسنج دیجیتال روی یخچال" },
  { id: "logger", label: "دیتالاگر دما (ثبت‌کننده)" },
] as const;

export interface FitCheck { ok: boolean; label: string }
/** Does this driver's truck suit the order? Used on the assignment card so the shipper can judge it. */
export function vehicleFit(v: { kind: VehicleKind; capacityKg: number; minTemp: number | null; canRunAmbient: boolean }, o: { vehicleKind: VehicleKind; weightKg: number; tempMin?: number; cargoMode: string }): FitCheck[] {
  const out: FitCheck[] = [
    { ok: v.capacityKg >= o.weightKg, label: v.capacityKg >= o.weightKg ? `ظرفیت ${nfa(v.capacityKg)} کیلوگرم، بار شما ${nfa(o.weightKg)} کیلوگرم` : `ظرفیت (${nfa(v.capacityKg)} کیلوگرم) از وزن بار کمتر است` },
  ];
  if (o.cargoMode === "REFRIGERATED" && o.tempMin !== undefined) {
    const ok = v.minTemp !== null && v.minTemp <= o.tempMin;
    out.push({ ok, label: ok ? `یخچال تا ${nfa(v.minTemp!)}° می‌رسد، بار شما ${nfa(o.tempMin)}° می‌خواهد` : "یخچال به دمای موردنیاز بار نمی‌رسد" });
  }
  out.push({ ok: v.kind === o.vehicleKind, label: v.kind === o.vehicleKind ? "نوع خودرو همان است که انتخاب کردید" : `نوع خودرو (${VEHICLES[v.kind].short}) با انتخاب شما (${VEHICLES[o.vehicleKind].short}) فرق دارد` });
  return out;
}
