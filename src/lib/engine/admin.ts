import { applyScheduledConfig, cfgDef, cv } from "../config";
import { A, post } from "../ledger";
import type { AdminRole, AdminUser, Approval, ConfigChange, DriverControls, Rial, ShipperControls, State } from "../types";
import { adminOf, audit, DAY, driverOf, fail, HOUR, MIN, notify, now, ok, orderOf, person, setStatus, shipperOf, uid, type Actor, type Result } from "./core";
import { acceptDirect as _a } from "./orders";
import { executeWriteOff, payRefund, payoutAction } from "./payout";
import { resubmitToBoard } from "./orders";

/* ───────────────────────── RBAC ───────────────────────── */

export const PERM_LABELS: Record<string, string> = {
  dashboard: "داشبورد اجرایی",
  liveops: "نقشه‌ی زنده‌ی عملیات",
  "orders.view": "مشاهده‌ی سفارش‌ها",
  "orders.act": "مداخله در سفارش‌ها",
  dispatch: "کنسول توزیع بار",
  "drivers.view": "مشاهده‌ی رانندگان",
  "drivers.kyc": "بررسی مدارک (KYC)",
  "drivers.act": "تعلیق/مسدودی راننده",
  "shippers.view": "مشاهده‌ی صاحبان بار",
  "shippers.act": "مسدودی و محدودیت صاحب بار",
  pro: "برنامه‌ی کامیونت پرو",
  pricing: "قیمت‌گذاری و تنظیمات",
  "finance.view": "مشاهده‌ی امور مالی",
  "finance.payouts": "برداشت‌ها و دسته‌های پرداخت",
  "finance.refunds": "بازپرداخت‌ها",
  "finance.adjust": "تعدیل کیف پول و سند دستی",
  "finance.config": "تنظیمات کارمزد و مالی",
  "finance.receipts": "تأیید رسید کارت‌به‌کارت",
  "finance.recon": "مغایرت‌گیری و بستن روز",
  "finance.credit": "اعتبار سازمانی و فاکتورها",
  "finance.promo": "کد تخفیف و مشوق‌ها",
  "finance.debt": "بدهی کارمزد و وصول",
  "finance.export": "خروجی‌های مالی",
  disputes: "اختلاف‌ها و مغایرت‌ها",
  "support.trip": "پشتیبانی سفر",
  "support.account": "پشتیبانی حساب و احراز",
  "support.finance": "پشتیبانی مالی",
  team: "تیم و دسترسی‌ها",
  rules: "قوانین و سیاست‌ها",
  reviews: "نظرات",
  insurance: "بیمه",
  cleanliness: "برنامه‌ی نظافت",
  risk: "تقلب و ریسک",
  broadcasts: "اعلان‌ها و ارسال گروهی",
  analytics: "تحلیل‌ها",
  master: "داده‌های پایه",
  integrations: "یکپارچه‌سازی‌ها",
  system: "سلامت سیستم",
  exports: "مرکز خروجی",
};

export const ALL_PERMS = Object.keys(PERM_LABELS);
const FIN_ALL = ALL_PERMS.filter((p) => p.startsWith("finance."));

export const ROLE_LABELS: Record<AdminRole, string> = {
  super: "مدیر ارشد",
  ops: "مدیر عملیات",
  support: "کارشناس پشتیبانی",
  kyc: "بازبین احراز هویت",
  finance_mgr: "مدیر مالی",
  finance_op: "اپراتور مالی",
  wallet_support: "پشتیبان مالی و کیف پول",
  accountant: "حسابدار (فقط‌خواندنی)",
};

export const ROLE_PERMS: Record<AdminRole, string[]> = {
  super: ALL_PERMS,
  ops: ["dashboard", "liveops", "orders.view", "orders.act", "dispatch", "drivers.view", "shippers.view", "pro", "disputes", "support.trip", "analytics", "cleanliness", "risk", "reviews", "broadcasts", "master"],
  support: ["dashboard", "orders.view", "drivers.view", "shippers.view", "support.trip", "support.account", "reviews", "disputes"],
  kyc: ["dashboard", "drivers.view", "drivers.kyc", "support.account"],
  finance_mgr: ["dashboard", "orders.view", "drivers.view", "shippers.view", ...FIN_ALL, "support.finance", "analytics", "exports", "risk", "disputes", "insurance", "pricing"],
  finance_op: ["orders.view", "finance.view", "finance.payouts", "finance.recon", "finance.receipts", "finance.export"],
  wallet_support: ["orders.view", "drivers.view", "shippers.view", "finance.view", "finance.refunds", "support.finance"],
  accountant: ["finance.view", "finance.export", "exports", "analytics"],
};

/** Approval ceilings (Rial) per role; above the ceiling an action needs a second approver. */
export const CEILINGS: Record<AdminRole, { refund: Rial; adjust: Rial; payout: Rial }> = {
  super: { refund: Infinity, adjust: Infinity, payout: Infinity },
  ops: { refund: 0, adjust: 0, payout: 0 },
  support: { refund: 0, adjust: 0, payout: 0 },
  kyc: { refund: 0, adjust: 0, payout: 0 },
  finance_mgr: { refund: 2_000_000_000, adjust: 1_000_000_000, payout: Infinity },
  finance_op: { refund: 200_000_000, adjust: 100_000_000, payout: 1_000_000_000 },
  wallet_support: { refund: 50_000_000, adjust: 20_000_000, payout: 0 },
  accountant: { refund: 0, adjust: 0, payout: 0 },
};

export const can = (role: AdminRole | undefined, perm: string) => !!role && ROLE_PERMS[role].includes(perm);

export function adminActor(s: State, adminId: string): Actor {
  const a = adminOf(s, adminId);
  return { type: "admin", id: adminId, label: a ? `${a.name} (${ROLE_LABELS[a.role]})` : adminId };
}

export function guard(s: State, adminId: string, perm: string): Result<{ admin: AdminUser; actor: Actor }> {
  const a = adminOf(s, adminId);
  if (!a || !a.active) return fail("نشست مدیریت معتبر نیست.");
  if (!can(a.role, perm)) {
    const who = Object.entries(ROLE_PERMS).filter(([r, ps]) => r !== "super" && ps.includes(perm)).map(([r]) => ROLE_LABELS[r as AdminRole]);
    return fail(`نقش «${ROLE_LABELS[a.role]}» به «${PERM_LABELS[perm] ?? perm}» دسترسی ندارد.${who.length ? ` این اقدام با نقش‌های ${who.slice(0, 3).join("، ")} یا مدیر ارشد انجام می‌شود.` : ""}`);
  }
  return ok({ admin: a, actor: adminActor(s, adminId) });
}

/* ───────────────────────── approvals (four-eyes) ───────────────────────── */

export function requestApproval(s: State, actor: Actor, a: { action: string; title: string; amount?: Rial; payload: Record<string, unknown>; needs?: AdminRole[] }): Approval {
  const ap: Approval = { id: uid(s, "ap"), at: now(s), action: a.action, title: a.title, requestedBy: actor.id, amount: a.amount, payload: a.payload, status: "PENDING", needs: a.needs ?? ["finance_mgr", "super"] };
  s.approvals.unshift(ap);
  audit(s, actor, "approval.request", a.title, ap.id);
  return ap;
}

export function decideApproval(s: State, adminId: string, id: string, approve: boolean, reason = ""): Result {
  const ap = s.approvals.find((x) => x.id === id);
  const a = adminOf(s, adminId);
  if (!ap || ap.status !== "PENDING") return fail("این درخواست دیگر در انتظار نیست.");
  if (!a || !ap.needs.includes(a.role)) return fail(`فقط ${ap.needs.map((r) => ROLE_LABELS[r]).join(" یا ")} می‌تواند این درخواست را تأیید کند.`);
  if (ap.requestedBy === adminId) return fail("درخواست‌دهنده نمی‌تواند خودش آن را تأیید کند (تأیید دو نفره).");
  const actor = adminActor(s, adminId);
  ap.status = approve ? "APPROVED" : "REJECTED";
  ap.decidedBy = adminId;
  ap.decidedAt = now(s);
  ap.reason = reason;
  if (approve) {
    const p = ap.payload as Record<string, string | number>;
    switch (ap.action) {
      case "debt.writeoff": executeWriteOff(s, actor, String(p.debtId)); break;
      case "refund": { const r = s.refunds.find((x) => x.id === p.refundId); if (r && r.status === "PENDING_APPROVAL") payRefund(s, actor, r); break; }
      case "payout": payoutAction(s, actor, String(p.payoutId), "approve", "تأیید دو نفره"); break;
      case "adjust": applyAdjust(s, actor, String(p.personId), String(p.portal) as "shipper" | "driver", Number(p.delta), String(p.reason)); break;
      case "driver.ban": banNow(s, actor, String(p.driverId), String(p.reason)); break;
      case "commission": { const d = driverOf(s, String(p.driverId)); if (d) d.controls.commissionOverride = p.pct === -1 ? undefined : Number(p.pct); break; }
      case "journal": postJournal(s, actor, p.lines as unknown as [string, Rial][], String(p.memo)); break;
    }
  } else if (ap.action === "refund") {
    const r = s.refunds.find((x) => x.id === (ap.payload as Record<string, string>).refundId);
    if (r) r.status = "REJECTED";
  } else if (ap.action === "debt.writeoff") {
    const dd = s.debts.find((x) => x.id === (ap.payload as Record<string, string>).debtId);
    if (dd) { dd.status = "OPEN"; dd.stage = 3; }
  }
  audit(s, actor, approve ? "approval.approve" : "approval.reject", `${ap.title}${reason ? ` — ${reason}` : ""}`, ap.id);
  return ok();
}

/* ───────────────────────── ledger ops ───────────────────────── */

function applyAdjust(s: State, actor: Actor, personId: string, portal: "shipper" | "driver", delta: Rial, reason: string) {
  const acct = portal === "driver" ? A.dAvail(personId) : A.shipper(personId);
  post(s, { key: `adj:${uid(s, "x")}`, memo: `تعدیل دستی: ${reason}`, ref: { personId }, lines: [[A.EXP_ADJUST, delta], [acct, -delta]] });
  notify(s, personId, portal, "adjust", `${delta > 0 ? "افزایش" : "کاهش"} ${Math.abs(delta) / 10} تومانی کیف پول توسط پشتیبانی: ${reason}`, portal === "driver" ? "/driver/wallet/" : "/app/wallet/");
  audit(s, actor, "wallet.adjust", `${delta / 10} تومان · ${reason}`, personId);
}

export function adjustWallet(s: State, adminId: string, personId: string, portal: "shipper" | "driver", delta: Rial, reason: string): Result<{ pending?: boolean }> {
  const g = guard(s, adminId, "finance.adjust");
  if (!g.ok) return g;
  if (!reason.trim()) return fail("دلیل تعدیل الزامی است.");
  if (delta === 0) return fail("مبلغ تعدیل صفر است.");
  const cap = CEILINGS[g.admin.role].adjust;
  if (Math.abs(delta) > cap) {
    requestApproval(s, g.actor, { action: "adjust", title: `تعدیل ${delta / 10} تومان برای ${person(s, personId)?.name}`, amount: Math.abs(delta), payload: { personId, portal, delta, reason } });
    return ok({ pending: true });
  }
  applyAdjust(s, g.actor, personId, portal, delta, reason);
  return ok();
}

export function postJournal(s: State, actor: Actor, lines: [string, Rial][], memo: string) {
  post(s, { key: `jr:${uid(s, "j")}`, memo: `سند دستی: ${memo}`, lines });
  audit(s, actor, "journal.manual", memo);
}

export function requestJournal(s: State, adminId: string, lines: [string, Rial][], memo: string): Result {
  const g = guard(s, adminId, "finance.adjust");
  if (!g.ok) return g;
  if (lines.reduce((n, [, a]) => n + a, 0) !== 0) return fail("سند باید تراز باشد (جمع بدهکار = جمع بستانکار).");
  requestApproval(s, g.actor, { action: "journal", title: `سند دستی: ${memo}`, amount: Math.max(...lines.map(([, a]) => Math.abs(a))), payload: { lines, memo } });
  return ok();
}

/* ───────────────────────── driver operations ───────────────────────── */

export const KYC_REASONS = [
  "تصویر مدرک ناخوانا است",
  "تاریخ انقضای مدرک گذشته است",
  "نام روی مدرک با هویت ثبت‌شده یکی نیست",
  "سلفی با کارت ملی واضح نیست",
  "عکس خودرو یا باکس یخچالی کامل نیست",
  "پلاک با کارت خودرو مطابقت ندارد",
];

export function reviewKyc(s: State, adminId: string, driverId: string, approve: boolean, reasons: string[] = []): Result {
  const g = guard(s, adminId, "drivers.kyc");
  if (!g.ok) return g;
  const d = driverOf(s, driverId);
  if (!d || d.kyc.status !== "pending") return fail("این پرونده در صف بررسی نیست.");
  d.kyc.reviewer = g.admin.name;
  if (approve) {
    d.kyc.status = "verified";
    d.kyc.rejectReasons = undefined;
  } else {
    if (!reasons.length) return fail("حداقل یک دلیل رد انتخاب کنید.");
    d.kyc.status = "rejected";
    d.kyc.rejectReasons = reasons;
    d.kyc.rejectedAt = now(s);
    d.kyc.step = 0;
  }
  notify(s, driverId, "driver", "kyc", approve ? "مدارک شما تأیید شد؛ اکنون می‌توانید بار انتخاب کنید." : `مدارک شما نیاز به اصلاح دارد: ${reasons.join("؛ ")}`, "/driver/");
  audit(s, g.actor, approve ? "kyc.approve" : "kyc.reject", approve ? "تأیید" : reasons.join("؛ "), driverId);
  return ok();
}

export function suspendDriver(s: State, adminId: string, driverId: string, reason: string): Result {
  const g = guard(s, adminId, "drivers.act");
  if (!g.ok) return g;
  const d = driverOf(s, driverId);
  if (!d) return fail("راننده پیدا نشد.");
  d.suspension = { reason, since: now(s), appeal: "none" };
  notify(s, driverId, "driver", "suspended", `حساب شما معلق شد: ${reason}`, "/driver/profile/");
  audit(s, g.actor, "driver.suspend", reason, driverId);
  return ok();
}

export function reinstateDriver(s: State, adminId: string, driverId: string, note = ""): Result {
  const g = guard(s, adminId, "drivers.act");
  if (!g.ok) return g;
  const d = driverOf(s, driverId);
  if (!d) return fail("راننده پیدا نشد.");
  d.suspension = undefined;
  notify(s, driverId, "driver", "reinstated", "تعلیق حساب شما برداشته شد.", "/driver/");
  audit(s, g.actor, "driver.reinstate", note || "رفع تعلیق", driverId);
  return ok();
}

function banNow(s: State, actor: Actor, driverId: string, reason: string) {
  const d = driverOf(s, driverId);
  if (!d) return;
  d.suspension = { reason: `مسدودی دائم: ${reason}`, since: now(s), appeal: "rejected" };
  audit(s, actor, "driver.ban", reason, driverId);
}

export function banDriver(s: State, adminId: string, driverId: string, reason: string): Result<{ pending?: boolean }> {
  const g = guard(s, adminId, "drivers.act");
  if (!g.ok) return g;
  requestApproval(s, g.actor, { action: "driver.ban", title: `مسدودی دائم ${person(s, driverId)?.name}`, payload: { driverId, reason }, needs: ["super", "ops"] });
  return ok({ pending: true });
}

export function decideAppeal(s: State, adminId: string, driverId: string, accept: boolean, note: string): Result {
  const g = guard(s, adminId, "drivers.act");
  if (!g.ok) return g;
  const d = driverOf(s, driverId);
  if (!d?.suspension || d.suspension.appeal !== "open") return fail("درخواست تجدیدنظر بازی وجود ندارد.");
  if (accept) { d.suspension = undefined; d.strikes = d.strikes.slice(0, Math.max(0, d.strikes.length - 1)); }
  else d.suspension.appeal = "rejected";
  notify(s, driverId, "driver", "appeal", accept ? "درخواست تجدیدنظر شما پذیرفته و تعلیق برداشته شد." : `درخواست تجدیدنظر رد شد: ${note}`, "/driver/profile/");
  audit(s, g.actor, "driver.appeal", `${accept ? "پذیرش" : "رد"}: ${note}`, driverId);
  return ok();
}

export function setDriverControls(s: State, adminId: string, driverId: string, patch: Partial<DriverControls>): Result<{ pending?: boolean }> {
  const g = guard(s, adminId, "finance.config");
  if (!g.ok) return g;
  const d = driverOf(s, driverId);
  if (!d) return fail("راننده پیدا نشد.");
  const { commissionOverride, ...rest } = patch;
  Object.assign(d.controls, rest);
  audit(s, g.actor, "driver.controls", JSON.stringify(rest), driverId);
  if ("commissionOverride" in patch) {
    requestApproval(s, g.actor, { action: "commission", title: `تغییر کارمزد ${person(s, driverId)?.name} به ${commissionOverride === undefined ? "پیش‌فرض" : Math.round(commissionOverride * 100) + "٪"}`, payload: { driverId, pct: commissionOverride ?? -1 } });
    return ok({ pending: true });
  }
  return ok();
}

export function setShipperControls(s: State, adminId: string, shipperId: string, patch: Partial<ShipperControls>): Result {
  const g = guard(s, adminId, "shippers.act");
  if (!g.ok) return g;
  const sh = shipperOf(s, shipperId);
  if (!sh) return fail("صاحب بار پیدا نشد.");
  Object.assign(sh.controls, patch);
  audit(s, g.actor, "shipper.controls", JSON.stringify(patch), shipperId);
  return ok();
}

export function addNote(s: State, adminId: string, kind: "driver" | "shipper", id: string, text: string): Result {
  const g = guard(s, adminId, kind === "driver" ? "drivers.view" : "shippers.view");
  if (!g.ok) return g;
  const p = kind === "driver" ? driverOf(s, id) : shipperOf(s, id);
  if (!p || !text.trim()) return fail("یادداشت معتبر نیست.");
  p.notes.unshift({ id: uid(s, "nt"), at: now(s), by: g.admin.name, text: text.trim() });
  return ok();
}

/* ───────────────────────── config ───────────────────────── */

export function setConfigValue(s: State, adminId: string, key: string, value: unknown, effectiveAt?: number): Result {
  const g = guard(s, adminId, key.startsWith("commission") || key.startsWith("payout") || key.startsWith("cash") || key.startsWith("debt") || key.startsWith("settlement") || key.startsWith("vat") || key.startsWith("invoice") ? "finance.config" : "pricing");
  if (!g.ok) return g;
  const def = cfgDef(key);
  if (!def) return fail("پارامتر ناشناخته است.");
  if (typeof def.default === "number" && (typeof value !== "number" || Number.isNaN(value) || value < 0)) return fail("مقدار عددی معتبر وارد کنید.");
  if (def.kind === "pct" && (value as number) > 1) return fail("درصد باید بین ۰ و ۱۰۰ باشد.");
  const from = cv(s, key);
  const at = effectiveAt && effectiveAt > now(s) ? effectiveAt : now(s);
  const ch: ConfigChange = { id: uid(s, "cc"), key, at: now(s), effectiveAt: at, by: g.actor.label, from, to: value, applied: false };
  if (at > now(s)) s.config.scheduled.unshift(ch);
  else { s.config.values[key] = value; ch.applied = true; s.config.history.unshift(ch); }
  audit(s, g.actor, "config.set", `${def.label}: ${from} → ${value}${at > now(s) ? " (زمان‌بندی‌شده)" : ""}`, key);
  return ok();
}

/* ───────────────────────── order interventions ───────────────────────── */

export function manualAssign(s: State, adminId: string, orderId: string, driverId: string): Result {
  const g = guard(s, adminId, "dispatch");
  if (!g.ok) return g;
  const o = orderOf(s, orderId);
  const d = driverOf(s, driverId);
  if (!o || !d) return fail("سفارش یا راننده پیدا نشد.");
  if (!["OPEN", "PRO_POOL", "DIRECT_REQUESTED", "LOCKED"].includes(o.status)) return fail("این سفارش در مرحله‌ی تخصیص نیست.");
  o.directDriverId = driverId;
  o.assignMode = "DIRECT";
  o.status = "LOCKED";
  o.lockedBy = driverId;
  o.lockedUntil = now(s) + 10 * MIN;
  setStatus(s, o, "DIRECT_REQUESTED", g.actor, `تخصیص دستی به ${person(s, driverId)?.name}`);
  o.directExpiresAt = now(s) + 10 * MIN;
  notify(s, driverId, "driver", "direct", `پشتیبانی بار ${o.origin.city} ← ${o.dest.city} را برای شما پیشنهاد کرد.`, `/driver/order/?id=${o.id}`);
  audit(s, g.actor, "order.assign", person(s, driverId)?.name ?? driverId, orderId);
  void _a;
  return ok();
}

export function releaseOrderLock(s: State, adminId: string, orderId: string): Result {
  const g = guard(s, adminId, "orders.act");
  if (!g.ok) return g;
  const o = orderOf(s, orderId);
  if (!o || !["LOCKED", "AWAITING_DEPOSIT"].includes(o.status)) return fail("قفلی برای آزادسازی نیست.");
  resubmitToBoard(s, o);
  audit(s, g.actor, "order.release", "آزادسازی قفل/بیعانه", orderId);
  return ok();
}

export function broadcastToPro(s: State, adminId: string, orderId: string): Result {
  const g = guard(s, adminId, "dispatch");
  if (!g.ok) return g;
  const o = orderOf(s, orderId);
  if (!o || !["OPEN", "DIRECT_REQUESTED"].includes(o.status)) return fail("این سفارش قابل انتشار در بازار ویژه‌ی پرو نیست.");
  o.pool = "PRO_POOL";
  o.assignMode = "PRO_POOL";
  o.directDriverId = undefined;
  setStatus(s, o, "PRO_POOL", g.actor, "انتشار در بازار ویژه‌ی پرو توسط توزیع");
  audit(s, g.actor, "order.pro", "انتشار در بازار ویژه‌ی پرو", orderId);
  return ok();
}

export function boostOrder(s: State, adminId: string, orderId: string, extra: Rial): Result {
  const g = guard(s, adminId, "orders.act");
  if (!g.ok) return g;
  const o = orderOf(s, orderId);
  if (!o) return fail("سفارش پیدا نشد.");
  // Platform-funded boost: shows as a tip badge and is paid to the driver at settlement from the promo budget.
  post(s, { key: `boost:${o.id}:${s.seq}`, memo: "افزایش انعام جذب توسط پلتفرم", ref: { orderId }, lines: [[A.EXP_PROMO, extra], [A.escrow(o.id), -extra]] });
  o.tipPre += extra;
  o.paid.tip += extra;
  audit(s, g.actor, "order.boost", `+${extra / 10} تومان`, orderId);
  return ok();
}

export function orderNote(s: State, adminId: string, orderId: string, text: string): Result {
  const g = guard(s, adminId, "orders.view");
  if (!g.ok) return g;
  const o = orderOf(s, orderId);
  if (!o) return fail("سفارش پیدا نشد.");
  o.events.push({ at: now(s), to: o.status, by: g.admin.name, note: `یادداشت داخلی: ${text}` });
  return ok();
}

/* ───────────────────────── Pro, cleanliness ───────────────────────── */

export function proCriteria(s: State, d: NonNullable<ReturnType<typeof driverOf>>, stats: { trips: number; rating: number; onTime: number }) {
  const rows = [
    { id: "trips", label: "تعداد سفر", value: stats.trips, target: cv<number>(s, "pro.minTrips"), ok: stats.trips >= cv<number>(s, "pro.minTrips"), fmt: "int" },
    { id: "rating", label: "امتیاز", value: stats.rating, target: cv<number>(s, "pro.minRating"), ok: stats.rating >= cv<number>(s, "pro.minRating"), fmt: "num" },
    { id: "onTime", label: "وقت‌شناسی", value: stats.onTime, target: cv<number>(s, "pro.minOnTime"), ok: stats.onTime >= cv<number>(s, "pro.minOnTime"), fmt: "pct" },
    { id: "clean", label: "امتیاز نظافت", value: d.clean.score, target: cv<number>(s, "pro.minClean"), ok: d.clean.score >= cv<number>(s, "pro.minClean"), fmt: "int" },
    { id: "docs", label: "مدارک معتبر", value: d.suspension ? 0 : 1, target: 1, ok: !d.suspension, fmt: "bool" },
    { id: "violations", label: "بدون تخلف شدید", value: d.strikes.filter((x) => x.points >= 3).length === 0 ? 1 : 0, target: 1, ok: d.strikes.filter((x) => x.points >= 3).length === 0, fmt: "bool" },
  ];
  return { rows, eligible: rows.every((r) => r.ok) };
}

export function proInvite(s: State, adminId: string, driverId: string): Result {
  const g = guard(s, adminId, "pro");
  if (!g.ok) return g;
  const d = driverOf(s, driverId);
  if (!d || d.kyc.status !== "verified") return fail("فقط رانندگان تأییدشده دعوت می‌شوند.");
  d.pro = { ...d.pro, status: "invited", invitedAt: now(s) };
  notify(s, driverId, "driver", "pro", "تبریک! به برنامه‌ی «کامیونت پرو» دعوت شده‌اید.", "/driver/pro/");
  audit(s, g.actor, "pro.invite", person(s, driverId)?.name ?? "", driverId);
  return ok();
}

export function proAccept(s: State, driverId: string, schedule: boolean): Result {
  const d = driverOf(s, driverId);
  if (!d || d.pro.status !== "invited") return fail("دعوت فعالی ندارید.");
  if (schedule) { d.pro.inspection = "scheduled"; d.pro.inspectionAt = now(s) + 3 * DAY; }
  else { d.pro.status = "pro"; d.pro.since = now(s); }
  return ok();
}

export function proDecision(s: State, adminId: string, driverId: string, decision: "pass" | "fail" | "revoke" | "grant", note = ""): Result {
  const g = guard(s, adminId, "pro");
  if (!g.ok) return g;
  const d = driverOf(s, driverId);
  if (!d) return fail("راننده پیدا نشد.");
  if (decision === "pass" || decision === "grant") { d.pro = { ...d.pro, status: "pro", since: now(s), inspection: decision === "pass" ? "passed" : d.pro.inspection }; }
  if (decision === "fail") d.pro = { ...d.pro, inspection: "failed", status: "invited" };
  if (decision === "revoke") d.pro = { ...d.pro, status: "revoked" };
  notify(s, driverId, "driver", "pro", decision === "revoke" ? "وضعیت پرو شما لغو شد." : decision === "fail" ? "بازدید خودرو تأیید نشد." : "به باشگاه «کامیونت پرو» خوش آمدید!", "/driver/pro/");
  audit(s, g.actor, `pro.${decision}`, note, driverId);
  return ok();
}

export function submitWash(s: State, driverId: string, before: string, after: string, partnerId?: string): Result {
  const d = driverOf(s, driverId);
  if (!d) return fail("حساب راننده پیدا نشد.");
  if (!before || !after) return fail("عکس قبل و بعد از شست‌وشو هر دو لازم است.");
  s.washes.unshift({ id: uid(s, "wsh"), driverId, at: now(s), partnerId, before, after, status: "PENDING" });
  return ok();
}

export function washDecision(s: State, adminId: string, washId: string, approve: boolean): Result {
  const g = guard(s, adminId, "cleanliness");
  if (!g.ok) return g;
  const w = s.washes.find((x) => x.id === washId);
  const d = driverOf(s, w?.driverId);
  if (!w || !d || w.status !== "PENDING") return fail("درخواست شست‌وشو قابل بررسی نیست.");
  w.status = approve ? "APPROVED" : "REJECTED";
  if (approve) {
    d.clean.badgeUntil = now(s) + cv<number>(s, "clean.badgeDays") * DAY;
    d.clean.lastWashAt = w.at;
    d.clean.score = Math.min(100, d.clean.score + 6);
    d.vehicle.lastWashAt = w.at;
    d.vehicle.lastCargoOdor = "NONE";
  }
  notify(s, d.personId, "driver", "wash", approve ? "شست‌وشوی شما تأیید شد؛ نشان «تمیز تأییدشده» فعال است." : "عکس‌های شست‌وشو تأیید نشد؛ دوباره ثبت کنید.", "/driver/clean/");
  audit(s, g.actor, "wash.decide", approve ? "تأیید" : "رد", washId);
  return ok();
}

void applyScheduledConfig;
void HOUR;
