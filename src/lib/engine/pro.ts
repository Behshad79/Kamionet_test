import type { DriverProfile, State } from "../types";
import { cv } from "../config";
import { DAY, HOUR, audit, driverOf, fail, notify, now, ok, person, SYSTEM, type Result } from "./core";
import { proCriteria } from "./admin";
import { driverStats } from "./stats";

/* ───────────────────────── inspection scheduling ───────────────────────── */

export const INSPECT_CENTERS = ["مرکز بازرسی تهران · شهرک صنعتی شمس‌آباد", "مرکز بازرسی اصفهان · شهرک صنعتی محمودآباد", "مرکز بازرسی مشهد · سه‌راه ملک‌آباد"];
export const INSPECT_HOURS = [9, 11, 14, 16];
export const SLOT_CAPACITY = 2;

/** What the inspector scores, and how much each part weighs. A driver passes with ≥ 80 and no failed critical item. */
export const INSPECT_CHECKS: { id: string; label: string; weight: number; critical?: boolean; how: string }[] = [
  { id: "fridge", label: "عملکرد یخچال", weight: 30, critical: true, how: "تست نگه‌داشتن ۱۵ دقیقه‌ای دمای منفی ۱۸ درجه" },
  { id: "docs", label: "اصالت مدارک", weight: 20, critical: true, how: "تطبیق اصل کارت خودرو، بیمه و معاینه‌ی فنی" },
  { id: "clean", label: "نظافت و بوی باکس", weight: 20, how: "بازدید داخل باکس و بررسی بوی ماندگار" },
  { id: "logger", label: "ثبت‌کننده‌ی دما", weight: 15, how: "دقت حسگر و ارتباط با اپ" },
  { id: "ext", label: "ظاهر و ایمنی خودرو", weight: 15, how: "لاستیک، چراغ، بدنه و درِ باکس" },
];
export const PASS_SCORE = 80;

export interface Slot { at: number; center: string; booked: number; mine: boolean }

export function inspectionSlots(s: State, t: number, driverId?: string): Slot[] {
  const out: Slot[] = [];
  const days = cv<number>(s, "pro.inspectDays");
  for (let i = 1; i <= days; i++) {
    const day = new Date(t + i * DAY);
    if (day.getDay() === 5) continue; // Friday off
    for (const center of INSPECT_CENTERS) for (const h of INSPECT_HOURS) {
      const d = new Date(day); d.setHours(h, 0, 0, 0);
      const at = d.getTime();
      const booked = s.drivers.filter((x) => x.pro.inspection === "scheduled" && x.pro.inspectionAt === at && x.pro.inspectionCenter === center).length;
      out.push({ at, center, booked, mine: !!driverId && driverOf(s, driverId)?.pro.inspectionAt === at && driverOf(s, driverId)?.pro.inspectionCenter === center });
    }
  }
  return out;
}

export function bookInspection(s: State, driverId: string, at: number, center: string): Result {
  const d = driverOf(s, driverId);
  if (!d || !["invited"].includes(d.pro.status)) return fail("برای رزرو بازرسی باید دعوت‌نامه‌ی پرو داشته باشید.");
  const slot = inspectionSlots(s, now(s)).find((x) => x.at === at && x.center === center && !(x.mine));
  if (!slot) return fail("این زمان دیگر در دسترس نیست.");
  if (slot.booked >= SLOT_CAPACITY) return fail("ظرفیت این زمان پر شده است؛ زمان دیگری انتخاب کنید.");
  d.pro.inspection = "scheduled";
  d.pro.inspectionAt = at;
  d.pro.inspectionCenter = center;
  notify(s, driverId, "driver", "pro_inspect", `بازرسی پرو رزرو شد: ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(at)} · ${center}. اصل کارت خودرو، بیمه و معاینه‌ی فنی را همراه بیاورید.`, "/driver/profile/");
  return ok();
}

export function cancelInspection(s: State, driverId: string): Result {
  const d = driverOf(s, driverId);
  if (!d || d.pro.inspection !== "scheduled") return fail("بازرسی رزروشده‌ای ندارید.");
  d.pro.inspection = "none";
  d.pro.inspectionAt = undefined;
  d.pro.inspectionCenter = undefined;
  return ok();
}

/** Inspector result: weighted score + critical items. Pass → Pro. Fail → stays invited and may rebook after 7 days. */
export function recordInspection(s: State, actorLabel: string, driverId: string, scores: Record<string, number>, note: string): Result<{ score: number; passed: boolean }> {
  const d = driverOf(s, driverId);
  if (!d || d.pro.inspection !== "scheduled") return fail("بازرسی رزروشده‌ای وجود ندارد.");
  const score = Math.round(INSPECT_CHECKS.reduce((n, c) => n + c.weight * Math.max(0, Math.min(1, (scores[c.id] ?? 0) / 100)), 0));
  const critFail = INSPECT_CHECKS.some((c) => c.critical && (scores[c.id] ?? 0) < 60);
  const passed = score >= PASS_SCORE && !critFail;
  d.pro.inspectionNote = note;
  if (passed) {
    d.pro.inspection = "passed";
    d.pro.status = "pro";
    d.pro.since = now(s);
    d.controls.instantPayout = true;
    notify(s, driverId, "driver", "pro", "تبریک! بازرسی را با موفقیت گذراندید و اکنون «کامیونت پرو» هستید.", "/driver/profile/");
  } else {
    d.pro.inspection = "failed";
    notify(s, driverId, "driver", "pro", `نمره‌ی بازرسی ${score} بود و به حد نصاب نرسید. ${note || ""} می‌توانید پس از رفع ایرادها دوباره زمان بگیرید.`, "/driver/profile/");
  }
  audit(s, { type: "admin", id: "inspector", label: actorLabel }, "pro.inspection", `${person(s, driverId)?.name}: ${score} · ${passed ? "قبول" : "رد"}`, driverId);
  return ok({ score, passed });
}

/** Manual Pro by staff, e.g. an excellent driver who skips the waiting line. Needs a reason; audited by the caller. */
export function grantProManually(s: State, label: string, driverId: string, reason: string): Result {
  const d = driverOf(s, driverId);
  if (!d || d.kyc.status !== "verified") return fail("فقط رانندگان تأییدشده پرو می‌شوند.");
  if (reason.trim().length < 5) return fail("دلیل پرو دستی را بنویسید.");
  d.pro = { ...d.pro, status: "pro", since: now(s), inspection: "passed", inspectionNote: `پرو دستی: ${reason}`, grantedBy: label };
  d.controls.instantPayout = true;
  notify(s, driverId, "driver", "pro", "تیم کامیونت شما را به‌عنوان راننده‌ی ممتاز، مستقیماً «پرو» کرد. تبریک!", "/driver/profile/");
  return ok();
}

/* ───────────────────────── automatic invitation ───────────────────────── */

const dayKey = (t: number) => Math.floor(t / DAY);
export const proScanDue = (s: State) => cv<boolean>(s, "pro.autoInvite") && !s.txKeys[`proscan:${dayKey(now(s))}`];

export function proAutoScan(s: State): number {
  s.txKeys[`proscan:${dayKey(now(s))}`] = "1";
  let n = 0;
  for (const d of s.drivers) {
    if (d.kyc.status !== "verified" || d.pro.status !== "none" || d.suspension || d.controls.autoPro === false) continue;
    const st = driverStats(s, d.personId);
    if (!proCriteria(s, d, { trips: st.trips, rating: st.rating, onTime: st.onTime }).eligible) continue;
    d.pro = { ...d.pro, status: "invited", invitedAt: now(s) };
    notify(s, d.personId, "driver", "pro", "عملکرد شما عالی بوده! به برنامه‌ی «کامیونت پرو» دعوت شدید؛ زمان بازرسی را رزرو کنید.", "/driver/profile/");
    n++;
  }
  return n;
}

/* ───────────────────────── gamification (derived, never stored) ───────────────────────── */

export const LEVELS = [
  { id: 0, name: "راننده‌ی تأییدشده", xp: 0, perk: "دسترسی به بازار بار" },
  { id: 1, name: "پیمانکار فعال", xp: 450, perk: "نشان «فعال» روی پروفایل" },
  { id: 2, name: "ستاره‌ی مسیر", xp: 900, perk: "اولویت نمایش در جستجوی صاحبان بار" },
  { id: 3, name: "نزدیک به پرو", xp: 1350, perk: "دعوت‌نامه‌ی پرو پس از رسیدن به معیارها" },
] as const;

export interface Journey {
  xp: number;
  level: (typeof LEVELS)[number];
  next?: (typeof LEVELS)[number];
  pct: number;
  missions: { id: string; title: string; hint: string; value: number; target: number; xp: number }[];
  badges: { id: string; title: string; got: boolean; hint: string }[];
  streakDays: number;
}

export function proJourney(s: State, d: DriverProfile): Journey {
  const st = driverStats(s, d.personId);
  const t = now(s);
  const month = s.orders.filter((o) => o.driverId === d.personId && ["DELIVERED", "COMPLETED"].includes(o.status) && (o.deliveredAt ?? 0) >= t - 30 * DAY);
  const cancels = s.orders.filter((o) => o.driverId === d.personId && o.status === "CANCELLED_BY_DRIVER" && (o.cancel?.at ?? 0) >= t - 30 * DAY).length;
  const clean = !!d.clean.badgeUntil && d.clean.badgeUntil > t;
  const xp = Math.round(st.trips * 8 + st.rating * 60 + st.onTime * 120 + d.clean.score * 1.5 + (d.docs.insurance?.reviewed !== false ? 40 : 0) - d.strikes.reduce((n, x) => n + x.points * 30, 0));
  const level = [...LEVELS].reverse().find((l) => xp >= l.xp) ?? LEVELS[0];
  const next = LEVELS[level.id + 1];
  const days = new Set(month.map((o) => Math.floor((o.deliveredAt ?? 0) / DAY)));
  return {
    xp, level, next, pct: next ? Math.min(100, ((xp - level.xp) / (next.xp - level.xp)) * 100) : 100,
    streakDays: days.size,
    missions: [
      { id: "trips", title: "۱۰ سفر موفق در ۳۰ روز", hint: "هر سفر تحویل‌شده یک قدم نزدیک‌تر", value: month.length, target: 10, xp: 120 },
      { id: "clean", title: "دریافت نشان «تمیز تأییدشده»", hint: "یک شست‌وشوی ثبت‌شده کافی است", value: clean ? 1 : 0, target: 1, xp: 80 },
      { id: "nocancel", title: "یک ماه بدون لغو", hint: "لغو پس از تخصیص امتیاز منفی دارد", value: cancels === 0 ? 1 : 0, target: 1, xp: 100 },
      { id: "rating", title: "میانگین امتیاز ۴٫۶ یا بالاتر", hint: "رفتار حرفه‌ای و وقت‌شناسی", value: Math.min(st.rating, 4.6), target: 4.6, xp: 150 },
    ],
    badges: [
      { id: "b1", title: "اولین سفر", got: st.trips >= 1, hint: "یک سفر موفق" },
      { id: "b10", title: "۱۰ سفر", got: st.trips >= 10, hint: "ده سفر موفق" },
      { id: "b50", title: "۵۰ سفر", got: st.trips >= 50, hint: "پنجاه سفر موفق" },
      { id: "b100", title: "۱۰۰ سفر", got: st.trips >= 100, hint: "صد سفر موفق" },
      { id: "bc", title: "نشان تمیز", got: clean, hint: "نشان نظافت فعال" },
      { id: "bs", title: "ستاره‌ی پنج‌گانه", got: st.rating >= 4.8, hint: "امتیاز ۴٫۸ و بالاتر" },
      { id: "bt", title: "همیشه به‌موقع", got: st.onTime >= 0.95, hint: "وقت‌شناسی ۹۵٪" },
      { id: "bn", title: "بی‌حاشیه", got: d.strikes.length === 0, hint: "بدون امتیاز منفی" },
    ],
  };
}
void SYSTEM; void HOUR;
