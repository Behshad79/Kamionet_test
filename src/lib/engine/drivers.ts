import { cv } from "../config";
import { rng } from "../rng";
import { A, bal } from "../ledger";
import { matchVehicle } from "../matching";
import type { DriverProfile, Order, State } from "../types";
import { DAY, driverOf, now } from "./core";
import { driverStats } from "./stats";

export type DriverStage = "not_started" | "in_review" | "rejected" | "verified" | "pro_invited" | "pro" | "suspended";

export function docExpiry(d: DriverProfile, t: number) {
  const items = (["insurance", "inspection"] as const).map((k) => {
    const at = d.docs[k]?.expiresAt;
    return { key: k, label: k === "insurance" ? "بیمه‌ی شخص ثالث" : "معاینه‌ی فنی", expiresAt: at, days: at ? Math.ceil((at - t) / DAY) : undefined };
  });
  return { items, expired: items.filter((i) => i.days !== undefined && i.days < 0), soon: items.filter((i) => i.days !== undefined && i.days >= 0 && i.days <= 30) };
}

export function suspensionOf(s: State, d: DriverProfile): { reason: string; since: number; appeal: "none" | "open" | "rejected" | "accepted"; derived: boolean } | undefined {
  if (d.suspension) return { ...d.suspension, derived: false };
  if (d.kyc.status === "verified") {
    const ex = docExpiry(d, now(s)).expired;
    if (ex.length) return { reason: `${ex.map((e) => e.label).join(" و ")} منقضی شده است`, since: ex[0].expiresAt ?? now(s), appeal: "none", derived: true };
  }
  return undefined;
}

export function driverStage(s: State, d: DriverProfile | undefined): DriverStage {
  if (!d) return "not_started";
  if (suspensionOf(s, d)) return "suspended";
  switch (d.kyc.status) {
    case "none":
    case "draft": return "not_started";
    case "pending": return "in_review";
    case "rejected": return "rejected";
  }
  if (d.pro.status === "pro") return "pro";
  if (d.pro.status === "invited") return "pro_invited";
  return "verified";
}

export const isVerified = (st: DriverStage) => st === "verified" || st === "pro" || st === "pro_invited";

export const STAGE_LABEL: Record<DriverStage, string> = {
  not_started: "احراز شروع نشده",
  in_review: "در انتظار بررسی",
  rejected: "نیازمند اصلاح",
  verified: "تأییدشده",
  pro_invited: "دعوت‌شده به پرو",
  pro: "کامیونت پرو",
  suspended: "معلق",
};

export function openDebt(s: State, pid: string) {
  return bal(s, A.dDebt(pid));
}

/** Why this driver cannot take a load right now (null = free to take). */
export function claimBlock(s: State, d: DriverProfile | undefined): string | null {
  const st = driverStage(s, d);
  if (!d || st === "not_started") return "برای دریافت بار ابتدا احراز هویت را کامل کنید.";
  if (st === "in_review") return "مدارک شما در حال بررسی است؛ پس از تأیید می‌توانید بار انتخاب کنید.";
  if (st === "rejected") return "مدارک شما نیاز به اصلاح دارد.";
  if (st === "suspended") return "حساب شما معلق است.";
  const waiting = s.orders.find((o) => o.driverId === d.personId && o.status === "AWAITING_DEPOSIT");
  if (waiting) return `منتظر پرداخت بیعانه‌ی سفارش ${waiting.origin.city} ← ${waiting.dest.city} هستیم؛ تا نتیجه (حداکثر چند دقیقه) بار جدید نمی‌توانید بردارید.`;
  const debt = openDebt(s, d.personId);
  if (debt >= cv<number>(s, "debt.restrictAt")) return "برای پذیرش بار جدید، ابتدا بدهی کارمزد را تسویه کنید.";
  const rd = s.debts.find((x) => x.driverId === d.personId && x.status === "OPEN" && x.stage >= 2);
  if (rd) return "پذیرش بار جدید تا شارژ کیف پول و تسویه‌ی بدهی کارمزد محدود شده است.";
  return null;
}

export function cashEligibleDriver(s: State, d: DriverProfile) {
  if (!cv<boolean>(s, "cash.enabled") || !d.controls.cashToDriver) return false;
  if (openDebt(s, d.personId) > 0) return false;
  return driverStats(s, d.personId).trips >= cv<number>(s, "cash.minDriverTrips");
}

export type Eligibility = { ok: true } | { ok: false; why: string };

/** Can this driver SEE the order on the board, and can they take it? */
export function eligibility(s: State, d: DriverProfile | undefined, o: Order): Eligibility {
  if (!d) return { ok: false, why: "حساب راننده ندارید." };
  if (o.shipperId === d.personId) return { ok: false, why: "این سفارش متعلق به حساب شماست." };
  const m = matchVehicle(d.vehicle, o);
  if (!m.ok) return { ok: false, why: m.why };
  if (o.status === "PRO_POOL" && d.pro.status !== "pro") return { ok: false, why: "مخصوص رانندگان پرو" };
  if (o.status === "DIRECT_REQUESTED" && o.directDriverId !== d.personId) return { ok: false, why: "درخواست مستقیم برای راننده‌ی دیگری است." };
  if (o.cleanOnly && !(d.clean.badgeUntil && d.clean.badgeUntil > now(s))) return { ok: false, why: "فقط خودروهای تمیزِ تأییدشده" };
  if (o.terms === "CASH_BALANCE_TO_DRIVER" && !cashEligibleDriver(s, d)) return { ok: false, why: "این سفارش پرداخت نقدی دارد و حساب شما شرایط آن را ندارد." };
  return { ok: true };
}

/** Stable weighted-random Pro pick. Weight = rating² × on-time; deterministic per order for reproducible demos. */
export function smartPick(s: State, o: Order, exclude: string[] = []): DriverProfile | undefined {
  const pool = s.drivers.filter(
    (d) =>
      d.pro.status === "pro" &&
      d.personId !== o.shipperId &&
      !exclude.includes(d.personId) &&
      !claimBlock(s, d) &&
      eligibility(s, d, { ...o, status: "PRO_POOL" }).ok &&
      !s.orders.some((x) => x.driverId === d.personId && ["ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "IN_TRANSIT", "AT_DELIVERY", "MISMATCH_REVIEW"].includes(x.status)),
  );
  if (!pool.length) return undefined;
  const r = rng(s.seq * 2654435761);
  return r.weighted(pool, (d) => {
    const st = driverStats(s, d.personId);
    return Math.max(0.1, st.rating * st.rating) * (0.5 + st.onTime) * (d.vehicle.thermo?.connected ? 1.4 : 1);
  });
}

export const driverOfOrder = (s: State, o: Order) => driverOf(s, o.driverId);
