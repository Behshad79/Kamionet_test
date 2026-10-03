import type { ConfigChange, State } from "./types";

/**
 * Every business number lives here as an admin-editable default.
 * Money is Rial; fractions are 0–1; durations carry their unit in the key.
 */
export type CfgKind = "pct" | "rial" | "int" | "min" | "hour" | "day" | "bool" | "enum" | "num";

export interface CfgDef {
  key: string;
  group: string;
  label: string;
  kind: CfgKind;
  default: number | string | boolean;
  options?: { id: string; label: string }[];
  help?: string;
}

const G = {
  fees: "کارمزد و تسویه",
  deposit: "بیعانه و پرداخت",
  cancel: "لغو و انتظار",
  insurance: "بیمه و مالیات",
  payout: "برداشت و کیف پول",
  cash: "پرداخت نقدی به راننده",
  debt: "بدهی کارمزد",
  trust: "اعتماد و کیفیت",
  pro: "کامیونت پرو",
  match: "تطبیق و تخصیص",
} as const;

export const CONFIG_DEFS: CfgDef[] = [
  { key: "commission.standard", group: G.fees, label: "کارمزد پایه", kind: "pct", default: 0.2 },
  { key: "commission.pro", group: G.fees, label: "کارمزد رانندگان پرو", kind: "pct", default: 0.18 },
  { key: "commission.ambient", group: G.fees, label: "کارمزد بار غیریخچالی", kind: "pct", default: 0.15 },
  { key: "commission.tips", group: G.fees, label: "کارمزد انعام", kind: "pct", default: 0 },
  { key: "settlement.disputeWindowH", group: G.fees, label: "پنجره‌ی اعتراض پس از تحویل", kind: "hour", default: 24 },
  { key: "invoice.model", group: G.insurance, label: "مدل صدور فاکتور", kind: "enum", default: "BROKER", options: [{ id: "BROKER", label: "کارگزار (فاکتور کل کرایه)" }, { id: "MARKETPLACE", label: "بازارگاه (فقط کارمزد)" }], help: "نیاز به تأیید حسابدار و حقوقی" },
  { key: "vat.rate", group: G.insurance, label: "نرخ مالیات بر ارزش افزوده", kind: "pct", default: 0 },
  { key: "vat.onFeesOnly", group: G.insurance, label: "مالیات فقط روی کارمزد و خدمات", kind: "bool", default: true },
  { key: "insurance.mode", group: G.insurance, label: "حالت بیمه‌ی بار", kind: "enum", default: "optional", options: [{ id: "optional", label: "اختیاری" }, { id: "mandatory", label: "اجباری" }] },

  { key: "deposit.pct", group: G.deposit, label: "درصد بیعانه", kind: "pct", default: 0.1 },
  { key: "deposit.dueMin", group: G.deposit, label: "مهلت پرداخت بیعانه", kind: "min", default: 10 },
  { key: "lock.seconds", group: G.deposit, label: "مهلت تأیید نهایی راننده", kind: "num", default: 150 },
  { key: "direct.windowMin", group: G.deposit, label: "مهلت پاسخ راننده به درخواست مستقیم", kind: "min", default: 10 },
  { key: "mismatch.slaMin", group: G.deposit, label: "مهلت پاسخ صاحب بار به مغایرت", kind: "min", default: 15 },
  { key: "mismatch.adjustPct", group: G.deposit, label: "حد تعدیل قیمت پیشنهادی مغایرت (±)", kind: "pct", default: 0.15 },
  { key: "tip.postWindowH", group: G.deposit, label: "مهلت انعام پس از سفر", kind: "hour", default: 72 },

  { key: "cancel.windowMin", group: G.cancel, label: "بازه‌ی بازگشت کامل بیعانه", kind: "min", default: 5 },
  { key: "cancel.midShare", group: G.cancel, label: "سهم راننده از بیعانه (قبل از حرکت)", kind: "pct", default: 0.5 },
  { key: "cancel.departShare", group: G.cancel, label: "سهم راننده از بیعانه (پس از حرکت)", kind: "pct", default: 1 },
  { key: "cancel.platformCut", group: G.cancel, label: "سهم پلتفرم از جریمه‌ی لغو", kind: "pct", default: 0.1 },
  { key: "cancel.deadheadPerKm", group: G.cancel, label: "جبران رفت خالی به ازای هر کیلومتر", kind: "rial", default: 120_000 },
  { key: "cancel.deadheadCap", group: G.cancel, label: "سقف جبران رفت خالی", kind: "rial", default: 60_000_000 },
  { key: "waiting.freeMin", group: G.cancel, label: "انتظار رایگان در مبدأ/مقصد", kind: "min", default: 60 },
  { key: "waiting.feePerHour", group: G.cancel, label: "هزینه‌ی هر ساعت انتظار", kind: "rial", default: 3_000_000 },
  { key: "strike.driverCancel", group: G.cancel, label: "امتیاز منفی لغو توسط راننده", kind: "int", default: 2 },
  { key: "strike.suspendAt", group: G.cancel, label: "تعلیق خودکار در مجموع امتیاز منفی", kind: "int", default: 6 },

  { key: "payout.min", group: G.payout, label: "حداقل برداشت", kind: "rial", default: 5_000_000 },
  { key: "payout.max", group: G.payout, label: "حداکثر برداشت در هر درخواست", kind: "rial", default: 3_000_000_000 },
  { key: "payout.dailyLimit", group: G.payout, label: "سقف برداشت روزانه", kind: "rial", default: 6_000_000_000 },
  { key: "payout.fourEyes", group: G.payout, label: "آستانه‌ی تأیید دو نفره", kind: "rial", default: 1_000_000_000 },
  { key: "payout.instantFeePct", group: G.payout, label: "کارمزد برداشت فوری", kind: "pct", default: 0.015 },
  { key: "payout.firstHold", group: G.payout, label: "بررسی دستی اولین برداشت", kind: "bool", default: true },

  { key: "cash.enabled", group: G.cash, label: "پرداخت نقدی به راننده فعال باشد", kind: "bool", default: true },
  { key: "cash.minDriverTrips", group: G.cash, label: "حداقل سفر موفق راننده", kind: "int", default: 10 },
  { key: "cash.maxOrder", group: G.cash, label: "سقف ارزش سفارش", kind: "rial", default: 600_000_000 },

  { key: "debt.restrictAt", group: G.debt, label: "محدودیت پذیرش بار از این بدهی", kind: "rial", default: 150_000_000 },
  { key: "debt.stage1Hours", group: G.debt, label: "شروع یادآوری پس از", kind: "hour", default: 24 },
  { key: "debt.stage2Hours", group: G.debt, label: "الزام شارژ کیف پول پس از", kind: "hour", default: 72 },
  { key: "debt.stage4Hours", group: G.debt, label: "تعلیق پس از", kind: "hour", default: 240 },

  { key: "review.revealDays", group: G.trust, label: "آشکارشدن نظر یک‌طرفه پس از", kind: "day", default: 7 },
  { key: "clean.badgeDays", group: G.trust, label: "اعتبار نشان «تمیز تأییدشده»", kind: "day", default: 30 },
  { key: "clean.washCreditPct", group: G.trust, label: "تخفیف شست‌وشو در مراکز همکار", kind: "pct", default: 0.1 },

  { key: "pro.minTrips", group: G.pro, label: "حداقل سفر برای پرو", kind: "int", default: 100 },
  { key: "pro.minRating", group: G.pro, label: "حداقل امتیاز", kind: "num", default: 4.6 },
  { key: "pro.minOnTime", group: G.pro, label: "حداقل وقت‌شناسی", kind: "pct", default: 0.92 },
  { key: "pro.minClean", group: G.pro, label: "حداقل امتیاز نظافت", kind: "int", default: 80 },
  { key: "pro.uplift", group: G.pro, label: "افزایش کرایه‌ی سرویس پرو", kind: "pct", default: 0.15 },

  { key: "match.directFallbackAuto", group: G.match, label: "پس از انقضای درخواست مستقیم، آزادسازی خودکار به استخر پرو", kind: "bool", default: false },
];

const BY_KEY = new Map(CONFIG_DEFS.map((d) => [d.key, d]));
export const cfgDef = (key: string) => BY_KEY.get(key);
export const cfgGroups = () => [...new Set(CONFIG_DEFS.map((d) => d.group))];

export function cv<T = number>(s: Pick<State, "config">, key: string): T {
  const v = s.config.values[key];
  if (v !== undefined) return v as T;
  const d = BY_KEY.get(key);
  if (!d) throw new Error(`unknown config key ${key}`);
  return d.default as T;
}

/** Apply any scheduled change whose effective time has arrived. */
export function applyScheduledConfig(s: State, now: number) {
  let n = 0;
  for (const c of s.config.scheduled) {
    if (c.applied || c.effectiveAt > now) continue;
    s.config.values[c.key] = c.to;
    c.applied = true;
    s.config.history.unshift({ ...c });
    n++;
  }
  if (n) s.config.scheduled = s.config.scheduled.filter((c) => !c.applied);
  return n;
}

export type { ConfigChange };
