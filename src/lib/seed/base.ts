import { DRIVER_RULES, SHIPPER_RULES } from "../rulesText";
import { EMPTY_STATE } from "../seedBase";
import type { AdminRole, State } from "../types";
import { R } from "../money";

const DAY = 86_400_000;

/** Reference data every environment needs (admins, insurers, rules, rates). People/orders come from `populate`. */
export function baseState(now: number): State {
  const s = structuredClone(EMPTY_STATE) as State;
  s.version = EMPTY_STATE.version;

  const admins: [string, string, AdminRole][] = [
    ["09130000001", "نگار صالحی (مدیر کل)", "super"],
    ["09130000002", "کامران عباسی (عملیات)", "ops"],
    ["09130000003", "مهسا طاهری (پشتیبانی)", "support"],
    ["09130000004", "پویا نجفی (احراز هویت)", "kyc"],
    ["09130000005", "سمیرا قاسمی (مدیر مالی)", "finance_mgr"],
    ["09130000006", "آرش فروتن (پشتیبان کیف پول)", "wallet_support"],
    ["09130000007", "لیلا مرادی (حسابدار)", "accountant"],
  ];
  s.admins = admins.map(([phone, name, role], i) => ({
    id: `a-${i + 1}`, phone, name, role, twoFA: role === "super" || role.startsWith("finance"), active: true,
    createdAt: now - 400 * DAY, devices: [{ id: `dev-${i + 1}`, label: "Chrome · macOS", lastAt: now - i * 3_600_000, current: true }],
  }));

  s.insurers = [
    { id: "ins-1", name: "بیمه‌ی سپهر", hue: 210 },
    { id: "ins-2", name: "بیمه‌ی آرمان", hue: 150 },
    { id: "ins-3", name: "بیمه‌ی نگین", hue: 30 },
  ];
  s.products = [
    { id: "ip-basic", insurerId: "ins-1", name: "پایه", level: "BASIC", ambient: false, rate: 0.002, deductiblePct: 0.1, covers: ["تصادف", "آتش‌سوزی", "واژگونی"] },
    { id: "ip-std", insurerId: "ins-2", name: "استاندارد", level: "STANDARD", ambient: false, rate: 0.003, deductiblePct: 0.05, covers: ["تصادف", "آتش‌سوزی", "واژگونی", "سرقت", "خرابی یخچال"] },
    { id: "ip-comp", insurerId: "ins-3", name: "جامع", level: "COMPREHENSIVE", ambient: false, rate: 0.0045, deductiblePct: 0, covers: ["تصادف", "آتش‌سوزی", "واژگونی", "سرقت", "خرابی یخچال", "فساد ناشی از انحراف دما"] },
    { id: "ip-amb-basic", insurerId: "ins-1", name: "پایه (غیریخچالی)", level: "BASIC", ambient: true, rate: 0.0015, deductiblePct: 0.1, covers: ["تصادف", "آتش‌سوزی", "واژگونی"] },
    { id: "ip-amb-std", insurerId: "ins-2", name: "استاندارد (غیریخچالی)", level: "STANDARD", ambient: true, rate: 0.0025, deductiblePct: 0.05, covers: ["تصادف", "آتش‌سوزی", "واژگونی", "سرقت"] },
  ];

  s.washPartners = [
    { id: "wp-1", name: "کارواش صنعتی پارس", city: "تهران", creditPct: 0.1 },
    { id: "wp-2", name: "شست‌وشوی تریلی آریا", city: "اصفهان", creditPct: 0.1 },
    { id: "wp-3", name: "کارواش سنگین نور", city: "مشهد", creditPct: 0.15 },
  ];

  s.rules = [DRIVER_RULES, SHIPPER_RULES].map((r, i) => ({ ...r, id: `rule-${i + 1}`, publishedAt: now - 120 * DAY, draft: false }));

  const pairs: [string, string, number, number][] = [
    ["تهران", "اصفهان", 15, 20], ["تهران", "مشهد", 32, 42], ["تهران", "شیراز", 34, 44], ["تهران", "تبریز", 22, 29],
    ["تهران", "رشت", 8, 11], ["تهران", "کرج", 3, 4.5], ["اصفهان", "شیراز", 12, 16.5], ["مشهد", "تبریز", 55, 70],
    ["تهران", "اهواز", 30, 39], ["تهران", "قم", 3.5, 5], ["تهران", "ساری", 9, 12], ["اصفهان", "یزد", 7, 10],
    ["شیراز", "بندرعباس", 22, 29], ["تبریز", "ارومیه", 6, 8.5], ["مشهد", "گرگان", 30, 40], ["کرمان", "یزد", 9, 12],
  ];
  s.rates = pairs.map(([from, to, a, b], i) => ({ id: `r${i + 1}`, from, to, min: R(a * 1_000_000), max: R(b * 1_000_000) }));
  return s;
}
