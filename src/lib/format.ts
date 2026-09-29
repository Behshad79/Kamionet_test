import type { CargoType, OrderStatus, PayMethod, Payment, VehicleType } from "./types";

const nf = new Intl.NumberFormat("fa-IR");
export const fa = (n: number) => nf.format(Math.round(n));
export const toman = (n: number) => `${fa(n)} تومان`;
export const millions = (n: number) => `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(n / 1_000_000)} میلیون`;

const dateFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" });
const dateShort = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long" });
const dateNum = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" });

export const jDate = (t: number) => dateFmt.format(t);
export const jShort = (t: number) => dateShort.format(t);
export const jNum = (t: number) => dateNum.format(t);
export const hhmm = (t: number) => timeFmt.format(t);
export const jDateTime = (t: number) => `${jShort(t)}، ${hhmm(t)}`;

export function relative(t: number, now = Date.now()) {
  const s = Math.round((now - t) / 1000);
  if (s < 45) return "لحظاتی پیش";
  if (s < 3600) return `${fa(Math.round(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${fa(Math.round(s / 3600))} ساعت پیش`;
  return `${fa(Math.round(s / 86400))} روز پیش`;
}

export function daysUntil(t: number, now = Date.now()) {
  return Math.ceil((t - now) / 86_400_000);
}

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${fa(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0").replace(/\d/g, (d) => fa(+d))}`;
};

export const CARGO: Record<CargoType, { label: string }> = {
  dairy: { label: "لبنیات" },
  meat: { label: "گوشت و پروتئین" },
  pharma: { label: "دارو و تجهیزات دارویی" },
  icecream: { label: "بستنی و انجمادی" },
  other: { label: "سایر مواد فسادپذیر" },
};

export const VEHICLES: Record<VehicleType, string> = {
  pickup: "وانت یخچال‌دار",
  khavar: "خاور یخچال‌دار",
  truck10: "کامیون ۱۰ تنی یخچال‌دار",
  trailer: "تریلی یخچال‌دار",
};
export const VEHICLE_SHORT: Record<VehicleType, string> = { pickup: "وانت", khavar: "خاور", truck10: "کامیون ۱۰ تنی", trailer: "تریلی" };
/** Default payload (kg) per vehicle class. */
export const VEHICLE_CAPACITY: Record<VehicleType, number> = { pickup: 1500, khavar: 4500, truck10: 10_000, trailer: 24_000 };
export const VEHICLE_ORDER: VehicleType[] = ["pickup", "khavar", "truck10", "trailer"];
/** Relative price level of each class versus the 10-ton reference. */
export const VEHICLE_PRICE_FACTOR: Record<VehicleType, number> = { pickup: 0.5, khavar: 0.75, truck10: 1, trailer: 1.6 };

export const STATUS: Record<OrderStatus, { label: string; tone: "ok" | "warn" | "danger" | "info" | "neutral" | "brand" }> = {
  DRAFT: { label: "پیش‌نویس", tone: "neutral" },
  OPEN: { label: "در انتظار راننده", tone: "warn" },
  LOCKED: { label: "در حال تأیید راننده", tone: "brand" },
  ASSIGNED: { label: "راننده تعیین شد", tone: "info" },
  IN_TRANSIT: { label: "در مسیر", tone: "info" },
  DELIVERED: { label: "تحویل شد", tone: "ok" },
  CANCELLED: { label: "لغو شد", tone: "danger" },
  EXPIRED: { label: "منقضی شد", tone: "neutral" },
};

/* ───── Temperature: one source of truth for class, label and digits ───── */

const LRI = "\u2066";
const PDI = "\u2069";
/** Direction-isolated, Persian digits, true minus sign: renders identically inside any RTL sentence. */
export const degrees = (t: number) => `${LRI}${t < 0 ? "\u2212" : ""}${fa(Math.abs(t))}°${PDI}`;
export const tempRange = (min: number, max: number) => `${degrees(min)} تا ${degrees(max)}`;

export type TempClass = "frozen" | "chilled" | "cool";
export const TEMP_PRESETS: Record<TempClass, { min: number; max: number; label: string }> = {
  frozen: { min: -25, max: -18, label: "انجمادی" },
  chilled: { min: 0, max: 4, label: "سردخانه‌ای" },
  cool: { min: 8, max: 15, label: "خنک" },
};
/** Frozen means the ceiling is at or below −18°; cool means the floor is at or above 8°. */
export function tempClass(min: number, max: number): TempClass {
  if (max <= -18) return "frozen";
  if (min >= 8) return "cool";
  return "chilled";
}
export const tempClassLabel = (min: number, max: number) => TEMP_PRESETS[tempClass(min, max)].label;

export const weightLabel = (kg: number) => (kg >= 1000 ? `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(kg / 1000)} تن` : `${fa(kg)} کیلوگرم`);

export const PAY: Record<PayMethod, string> = {
  prepaid: "پیش‌پرداخت کامل",
  deposit: "بیعانه و مابقی هنگام تحویل",
  cod: "پرداخت هنگام تحویل",
};
export const payLabel = (p: Payment) => (p.method === "deposit" ? `بیعانه ${fa(p.depositPct ?? 30)}٪، مابقی هنگام تحویل` : PAY[p.method]);

/** "۱۴ میلیون تومان" / "۵ میلیارد تومان": explicit, never a bare "م". */
export function tomanWords(n: number) {
  const f = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
  if (n >= 1e9) return `${f.format(n / 1e9)} میلیارد تومان`;
  if (n >= 1e6) return `${f.format(n / 1e6)} میلیون تومان`;
  return `${fa(n)} تومان`;
}

export const windowLabel = (from: number, to: number) => `${jShort(from)}، ${hhmm(from)} تا ${hhmm(to)}`;
export const stars = (avg: number) => new Intl.NumberFormat("fa-IR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(avg);
