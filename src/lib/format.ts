import type { CargoType, OrderStatus, VehicleType } from "./types";

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

export const CARGO: Record<CargoType, { label: string; emoji: string }> = {
  dairy: { label: "لبنیات", emoji: "🥛" },
  meat: { label: "گوشت و پروتئین", emoji: "🥩" },
  pharma: { label: "دارو و تجهیزات دارویی", emoji: "💊" },
  icecream: { label: "بستنی و انجمادی", emoji: "🍦" },
  other: { label: "سایر مواد فسادپذیر", emoji: "📦" },
};

export const VEHICLES: Record<VehicleType, string> = {
  truck: "کامیونت یخچال‌دار",
  nissan: "وانت نیسان یخچال‌دار",
  pride: "وانت پراید یخچال‌دار",
  trailer: "تریلی یخچال‌دار",
};

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

export const tempLabel = (t: number) => (t <= -10 ? `انجمادی (${fa(t)}°)` : `سردخانه‌ای (تا ${fa(t)}°)`);
export const degrees = (t: number) => `${t < 0 ? "−" : ""}${fa(Math.abs(t))}°C`;
