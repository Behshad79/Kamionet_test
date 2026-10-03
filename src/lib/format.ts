import { fa, fmtToman, fmtTomanWords } from "./money";
import type { CargoKind, OrderStatus, PayTerms } from "./types";

export { fa };

/** Amounts are integer Rial; every screen shows Toman through these. */
export const toman = fmtToman;
export const tomanWords = fmtTomanWords;

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

export const CARGO: Record<CargoKind, { label: string }> = {
  dairy: { label: "لبنیات" },
  meat: { label: "گوشت و پروتئین" },
  fish: { label: "ماهی و میگو" },
  produce: { label: "میوه و سبزی" },
  icecream: { label: "بستنی و انجمادی" },
  pharma: { label: "دارو و تجهیزات دارویی" },
  dry: { label: "خشک‌بار" },
  other: { label: "سایر" },
};

type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "brand";
export const STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "پیش‌نویس", tone: "neutral" },
  OPEN: { label: "در انتظار راننده", tone: "warn" },
  PRO_POOL: { label: "در انتظار راننده‌ی حرفه‌ای", tone: "warn" },
  DIRECT_REQUESTED: { label: "درخواست مستقیم", tone: "brand" },
  LOCKED: { label: "در حال تأیید راننده", tone: "brand" },
  AWAITING_DEPOSIT: { label: "در انتظار بیعانه", tone: "warn" },
  ASSIGNED: { label: "راننده تعیین شد", tone: "info" },
  EN_ROUTE_TO_PICKUP: { label: "در راه مبدأ", tone: "info" },
  AT_PICKUP: { label: "در مبدأ", tone: "info" },
  MISMATCH_REVIEW: { label: "بررسی مغایرت", tone: "warn" },
  IN_TRANSIT: { label: "در مسیر", tone: "info" },
  AT_DELIVERY: { label: "در مقصد", tone: "info" },
  DELIVERED: { label: "تحویل شد", tone: "ok" },
  COMPLETED: { label: "تکمیل شد", tone: "ok" },
  CANCELLED_BY_SHIPPER: { label: "لغو توسط صاحب بار", tone: "danger" },
  CANCELLED_BY_DRIVER: { label: "لغو توسط راننده", tone: "danger" },
  CANCELLED_BY_SYSTEM: { label: "لغو توسط سیستم", tone: "danger" },
  EXPIRED: { label: "منقضی شد", tone: "neutral" },
  DISPUTED: { label: "در اختلاف", tone: "danger" },
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

export const PAY_TERMS: Record<PayTerms, string> = {
  PREPAID: "پیش‌پرداخت کامل",
  DEPOSIT_BALANCE_BEFORE_LOADING: "بیعانه و مابقی پیش از بارگیری",
  DEPOSIT_BALANCE_AFTER_DELIVERY: "بیعانه و مابقی پس از تحویل",
  CASH_BALANCE_TO_DRIVER: "بیعانه و مابقی نقد به راننده",
};

export const windowLabel = (from: number, to: number) => `${jShort(from)}، ${hhmm(from)} تا ${hhmm(to)}`;
export const stars = (avg: number) => new Intl.NumberFormat("fa-IR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(avg);

/** Persian digits for any string (times, plates, codes). */
export const faText = (x: string) => x.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
