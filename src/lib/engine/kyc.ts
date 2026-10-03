import type { DocKey, DriverProfile, Plate, State, Vehicle } from "../types";
import { DAY, HOUR, audit, driverOf, fail, now, ok, person, SYSTEM, uid, type Result } from "./core";
import { ensureDriver } from "./profiles";

/** Wizard steps; `step` on the profile is the next unfinished one, so the flow is resumable. */
export const KYC_STEPS = ["شماره موبایل", "هویت", "تطبیق شاهکار", "عکس چهره", "گواهینامه", "خودرو و مدارک", "قوانین", "ارسال"] as const;
export const MAX_ID_ATTEMPTS = 3;

const bump = (d: DriverProfile, to: number) => { d.kyc.step = Math.max(d.kyc.step, to); if (d.kyc.status === "none") d.kyc.status = "draft"; };

/** Test mode: any 10-digit national ID is accepted (checksum is not enforced) so flows can be demonstrated. */
export function validNationalId(id: string) {
  return /^\d{10}$/.test(id);
}

export function saveIdentity(s: State, pid: string, nationalId: string, birthDate: string): Result {
  const d = ensureDriver(s, pid);
  if (!/^\d{10}$/.test(nationalId)) return fail("کد ملی باید ۱۰ رقم باشد.");
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(birthDate)) return fail("تاریخ تولد را به شکل ۱۳۷۰/۰۵/۲۰ وارد کنید.");
  const p = person(s, pid)!;
  p.nationalId = nationalId;
  p.birthDate = birthDate;
  d.kyc.idMatch.status = "idle";
  bump(d, 2);
  return ok();
}

/**
 * Shahkar-style national-ID ↔ SIM match (mock): matches by default; the Demo Director can force a mismatch to show the retry/lock flow.
 * After 3 mismatches the wizard locks and a fraud flag opens for the KYC team.
 */
export function verifyShahkar(s: State, pid: string): Result<{ match: boolean; attemptsLeft: number }> {
  const d = ensureDriver(s, pid);
  const p = person(s, pid);
  if (!p?.nationalId) return fail("ابتدا کد ملی را ثبت کنید.");
  if (d.kyc.idMatch.attempts >= MAX_ID_ATTEMPTS && d.kyc.idMatch.status === "mismatch") return fail("تعداد تلاش‌ها به سقف رسیده است؛ برای ادامه با پشتیبانی احراز هویت تماس بگیرید.");
  const match = s.demo.idMatch !== "mismatch";
  d.kyc.idMatch.attempts++;
  d.kyc.idMatch.lastAt = now(s);
  if (match) {
    d.kyc.idMatch.status = "ok";
    bump(d, 3);
    return ok({ match: true, attemptsLeft: MAX_ID_ATTEMPTS - d.kyc.idMatch.attempts });
  }
  d.kyc.idMatch.status = "mismatch";
  const left = MAX_ID_ATTEMPTS - d.kyc.idMatch.attempts;
  if (left <= 0) {
    s.risk.unshift({ id: uid(s, "rk"), at: now(s), kind: "عدم تطبیق مکرر کد ملی و سیم‌کارت", personId: pid, severity: "high", detail: `${MAX_ID_ATTEMPTS} تلاش ناموفق`, status: "OPEN" });
    audit(s, SYSTEM, "kyc.idmatch.locked", "قفل پس از تلاش‌های ناموفق", pid);
  }
  return ok({ match: false, attemptsLeft: Math.max(0, left) });
}

export function setDoc(s: State, pid: string, key: DocKey, dataUrl: string, expiresAt?: number): Result {
  const d = driverOf(s, pid);
  if (!d) return fail("حساب راننده پیدا نشد.");
  d.docs[key] = { dataUrl, expiresAt: expiresAt ?? d.docs[key]?.expiresAt, reviewed: false };
  if (key === "selfie") bump(d, 4);
  if (key === "license" || key === "smartCard") bump(d, 4);
  return ok();
}

export function saveVehicle(s: State, pid: string, v: Partial<Vehicle> & { plate: Plate | null }, expiry: { insurance?: number; inspection?: number }): Result {
  const d = driverOf(s, pid);
  if (!d) return fail("حساب راننده پیدا نشد.");
  if (!v.plate || !/^\d{2}$/.test(v.plate.two) || !/^\d{3}$/.test(v.plate.three) || !/^\d{2}$/.test(v.plate.prov) || !v.plate.letter) return fail("پلاک خودرو را کامل وارد کنید.");
  d.vehicle = { ...d.vehicle, ...v, plate: v.plate };
  if (expiry.insurance) d.docs.insurance = { ...d.docs.insurance, expiresAt: expiry.insurance };
  if (expiry.inspection) d.docs.inspection = { ...d.docs.inspection, expiresAt: expiry.inspection };
  bump(d, 6);
  return ok();
}

export function kycReady(s: State, pid: string) {
  const d = driverOf(s, pid);
  const p = person(s, pid);
  const miss: string[] = [];
  if (!d || !p) return ["حساب"];
  if (!p.nationalId) miss.push("هویت");
  if (d.kyc.idMatch.status !== "ok") miss.push("تطبیق شاهکار");
  if (!d.docs.selfie?.dataUrl) miss.push("عکس چهره");
  if (!d.docs.license?.dataUrl && !d.docs.smartCard?.dataUrl) miss.push("گواهینامه یا کارت هوشمند");
  if (!d.vehicle.plate) miss.push("پلاک");
  if (!d.docs.insurance?.dataUrl || !d.docs.insurance.expiresAt) miss.push("عکس و تاریخ انقضای بیمه‌نامه");
  if (!d.docs.inspection?.dataUrl || !d.docs.inspection.expiresAt) miss.push("عکس و تاریخ انقضای معاینه‌ی فنی");
  if (!d.docs.regFront?.dataUrl) miss.push("کارت خودرو");
  return miss;
}

export function submitKyc(s: State, pid: string): Result {
  const d = driverOf(s, pid);
  if (!d) return fail("حساب راننده پیدا نشد.");
  const miss = kycReady(s, pid);
  if (miss.length) return fail(`موارد ناقص: ${miss.join("، ")}`);
  d.kyc.status = "pending";
  d.kyc.submittedAt = now(s);
  d.kyc.step = 7;
  d.kyc.rejectReasons = undefined;
  return ok();
}

export function resumeKycAfterReject(s: State, pid: string): Result {
  const d = driverOf(s, pid);
  if (!d || d.kyc.status !== "rejected") return fail("پرونده‌ای برای اصلاح وجود ندارد.");
  d.kyc.status = "draft";
  d.kyc.step = 4;
  return ok();
}

export function saveIban(s: State, pid: string, sheba: string): Result {
  const d = driverOf(s, pid);
  const p = person(s, pid);
  if (!d || !p) return fail("حساب راننده پیدا نشد.");
  const clean = sheba.replace(/\s/g, "").toUpperCase();
  if (!/^IR\d{24}$/.test(clean)) return fail("شماره‌ی شبا باید با IR شروع شود و ۲۶ کاراکتر باشد.");
  // Mock bank lookup: the holder name returned for a Sheba; a trailing 0 simulates a different owner.
  const matches = s.demo.ibanHolder !== "mismatch";
  d.iban = { sheba: clean, holder: matches ? p.name : "شخص دیگر", holderMatches: matches, addedAt: now(s) };
  return matches ? ok() : fail("نام صاحب این شبا با نام شما یکی نیست؛ فقط شبای متعلق به خودتان پذیرفته می‌شود.");
}

export function declareTrip(s: State, pid: string, t: { from: string; to: string; departAt: number; backTo: string; backAt?: number }): Result {
  const d = driverOf(s, pid);
  if (!d) return fail("حساب راننده پیدا نشد.");
  if (t.from === t.to) return fail("مبدأ و مقصد سفر نمی‌تواند یکی باشد.");
  d.declaredTrips.unshift({ id: uid(s, "tr"), ...t, active: true });
  d.declaredTrips = d.declaredTrips.slice(0, 5);
  return ok();
}

export const expiryLeftDays = (at: number | undefined, t: number) => (at ? Math.ceil((at - t) / DAY) : undefined);
void HOUR;

/** Renewing insurance / inspection needs a photo of the new document, not just a date. */
export function renewDoc(s: State, pid: string, key: "insurance" | "inspection", dataUrl: string, expiresAt: number): Result {
  const d = driverOf(s, pid);
  if (!d) return fail("حساب راننده پیدا نشد.");
  if (!dataUrl) return fail("عکس مدرک جدید را بارگذاری کنید.");
  if (expiresAt <= now(s) + DAY) return fail("تاریخ انقضا باید در آینده باشد.");
  d.docs[key] = { dataUrl, expiresAt, reviewed: false };
  if (d.suspension?.reason.includes("منقضی") && !d.suspension.reason.includes("بدهی")) d.suspension = undefined;
  audit(s, SYSTEM, "doc.renew", `${key} · در انتظار بازبینی`, pid);
  return ok();
}
