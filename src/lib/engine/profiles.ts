import { VEHICLES } from "../vehicles";
import type { DriverProfile, ShipperProfile, State } from "../types";
import { fail, now, ok, shipperOf, uid, type Result } from "./core";

export const refCode = (s: State, prefix: string) => `${prefix}${(1000 + ((s.seq * 7919) % 9000)).toString()}`;

export function blankShipper(s: State, personId: string, displayName: string): ShipperProfile {
  return {
    personId, displayName, businessVerified: false,
    memberSince: now(s), favorites: [], cargoCategories: [],
    controls: { creditLimit: 0, creditTermsDays: 0, invoiceCycle: "order", blockCardToCard: false, cashToDriver: false, couponEligible: true, walletFrozen: false, blocked: false },
    honesty: 100,
    prefs: { autoPayDeposit: false, refundTo: "wallet", quietHours: false, notify: { assigned: true, transit: true, delivered: true, mismatch: true, payment: true } },
    referralCode: refCode(s, "KS"), loyaltyTier: "bronze", notes: [], hue: (s.seq * 47) % 360,
  };
}

export function blankDriver(s: State, personId: string): DriverProfile {
  return {
    personId,
    kyc: { status: "none", step: 0, idMatch: { status: "idle", attempts: 0 } },
    vehicle: { kind: "nissan", capacityKg: VEHICLES.nissan.capacityKg, color: "#F3F4F6", plate: null, minTemp: 0, canRunAmbient: false, fridgeBrand: "", lastCargoOdor: "NONE" },
    docs: {}, pro: { status: "none", inspection: "none" }, strikes: [], clean: { score: 60 },
    controls: { walletFrozen: false, payoutHold: false, cashToDriver: false, maxDebt: 150_000_000, instantPayout: false, incentiveEligible: true },
    declaredTrips: [], online: false, referralCode: refCode(s, "KD"), notes: [], createdAt: now(s),
  };
}

export function ensureShipper(s: State, personId: string) {
  let p = s.shippers.find((x) => x.personId === personId);
  if (!p) {
    const name = s.persons.find((x) => x.id === personId)?.name ?? "کاربر جدید";
    p = blankShipper(s, personId, name);
    s.shippers.push(p);
  }
  return p;
}

export function ensureDriver(s: State, personId: string) {
  let p = s.drivers.find((x) => x.personId === personId);
  if (!p) {
    p = blankDriver(s, personId);
    s.drivers.push(p);
  }
  return p;
}

export type CompletenessKey = "name" | "company" | "verify" | "address" | "logo";
export const COMPLETENESS: { key: CompletenessKey; label: string; how: string }[] = [
  { key: "name", label: "نام نمایشی", how: "نام و نام خانوادگی یا نام برند را کامل بنویسید." },
  { key: "company", label: "اطلاعات شرکت", how: "نام شرکت و کد اقتصادی را ثبت کنید." },
  { key: "address", label: "نشانی و پین انبار", how: "نشانی دقیق را بنویسید و محل را روی نقشه پین کنید." },
  { key: "logo", label: "لوگو یا عکس پروفایل", how: "یک تصویر مربع و واضح بارگذاری کنید." },
  { key: "verify", label: "تأیید کسب‌وکار", how: "عکس جواز کسب یا روزنامه‌ی رسمی را بفرستید؛ پس از بازبینی تیم کامیونت تأیید می‌شود." },
];

/** Completeness is derived from real data: nothing can be ticked without doing the work. */
export function shipperCompleteness(sh: ShipperProfile): Record<CompletenessKey, boolean> {
  return {
    name: sh.displayName.trim().length >= 3 && sh.displayName !== "کاربر جدید",
    company: !!sh.company?.name?.trim() && (sh.company.economicCode ?? "").replace(/\D/g, "").length >= 8,
    address: !!sh.address && sh.address.text.trim().length >= 6,
    logo: !!sh.logo,
    verify: sh.verifyDoc?.status === "approved",
  };
}

export function saveShipperIdentity(s: State, pid: string, a: { displayName: string; company?: string; economicCode?: string }): Result {
  const sh = shipperOf(s, pid);
  if (!sh) return fail("حساب صاحب بار پیدا نشد.");
  if (a.displayName.trim().length < 3) return fail("نام نمایشی حداقل ۳ حرف باشد.");
  sh.displayName = a.displayName.trim();
  sh.company = a.company?.trim() ? { ...sh.company, name: a.company.trim(), economicCode: a.economicCode?.trim() || undefined } : undefined;
  return ok();
}

export function saveShipperAddress(s: State, pid: string, a: { text: string; lat: number; lng: number }): Result {
  const sh = shipperOf(s, pid);
  if (!sh) return fail("حساب صاحب بار پیدا نشد.");
  if (a.text.trim().length < 6) return fail("نشانی را کامل بنویسید.");
  sh.address = { text: a.text.trim(), lat: a.lat, lng: a.lng };
  return ok();
}

export function saveShipperLogo(s: State, pid: string, dataUrl: string): Result {
  const sh = shipperOf(s, pid);
  if (!sh) return fail("حساب صاحب بار پیدا نشد.");
  sh.logo = dataUrl;
  return ok();
}

export function submitVerifyDoc(s: State, pid: string, dataUrl: string): Result {
  const sh = shipperOf(s, pid);
  if (!sh) return fail("حساب صاحب بار پیدا نشد.");
  if (!sh.company?.name) return fail("ابتدا اطلاعات شرکت را ثبت کنید.");
  if (!dataUrl) return fail("عکس مدرک را بارگذاری کنید.");
  sh.verifyDoc = { dataUrl, at: now(s), status: "pending" };
  return ok();
}

void uid;
