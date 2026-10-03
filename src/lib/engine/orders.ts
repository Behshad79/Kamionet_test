import { applyScheduledConfig, cv } from "../config";
import { roadKm } from "../geo";
import { A, bal, post, shipperWallet } from "../ledger";
import { matchVehicle, MATCH_FAIL_TEXT } from "../matching";
import { VEHICLES } from "../vehicles";
import type {
  AssignMode, CargoKind, Media, Mismatch, MismatchType, Order, OrderInput, OrderStatus, OdorClass, Rial, State,
} from "../types";
import {
  ACTIVE_TRIP, actorPerson, audit, BOARD, DAY, driverOf, fail, HOUR, isTerminal, MIN, notify, now, ok, orderOf, PRE_ASSIGN,
  setStatus, shipperOf, SYSTEM, uid, type Actor, type Result,
} from "./core";
import { cashEligibleDriver, claimBlock, eligibility, smartPick } from "./drivers";
import {
  advanceAfterPayment, cancelPostings, cancelQuote, commissionRate, completePayment, couponDiscount, issueWaybill, outstanding, pay, releaseSettlement,
  settleDelayed, settleOrder, shipperPaid, totalDue,
} from "./pay";
import { needsAcceptance } from "./trust";

/* ───────────────────────── pricing ───────────────────────── */

export interface PriceQuote {
  freight: Rial;
  upliftPct: number;
  premium: Rial;
  coverage: Rial;
  deductible: Rial;
  productId: string | null;
  vat: Rial;
  tip: Rial;
  discount: Rial;
  couponError?: string;
  total: Rial;
  depositPct: number;
  depositRequired: Rial;
  securedMin: Rial;
  cashAgreed: Rial;
  commissionRate: number;
}

const r1000 = (n: number) => Math.round(n / 1000) * 1000;

export function insurancePremium(s: State, productId: string | null, declared: Rial, coveragePct: number) {
  const p = productId ? s.products.find((x) => x.id === productId) : undefined;
  if (!p) return { premium: 0, coverage: 0, deductible: 0, productId: null as string | null };
  const coverage = Math.round(declared * coveragePct);
  return { premium: r1000(coverage * p.rate), coverage, deductible: r1000(coverage * p.deductiblePct), productId: p.id as string | null };
}

export function priceOrder(s: State, shipperId: string, i: OrderInput): PriceQuote {
  const upliftPct = i.serviceClass === "PRO" ? cv<number>(s, "pro.uplift") : 0;
  const freight = r1000(i.freightBase * (1 + upliftPct));
  const mandatory = cv<string>(s, "insurance.mode") === "mandatory";
  const productId = i.insuranceProductId ?? (mandatory ? (i.cargoMode === "AMBIENT" ? "ip-amb-std" : "ip-std") : null);
  const ins = insurancePremium(s, productId, i.declaredValue, i.coveragePct || 1);
  const vatRate = cv<number>(s, "vat.rate");
  const vatBase = cv<boolean>(s, "vat.onFeesOnly") ? ins.premium : freight + ins.premium + i.tipPre;
  const vat = r1000(vatBase * vatRate);
  const gross = freight + ins.premium + vat + i.tipPre;
  let discount = 0;
  let couponError: string | undefined;
  if (i.couponCode) {
    const r = couponDiscount(s, shipperId, i.couponCode, { total: gross, route: `${i.origin.city}>${i.dest.city}`, vehicleKind: i.vehicleKind, cargoMode: i.cargoMode, serviceClass: i.serviceClass });
    if (r.ok) discount = r.discount;
    else couponError = r.error;
  }
  const total = gross - discount;
  const sh = shipperOf(s, shipperId);
  const depositPct = sh?.controls.depositPctOverride ?? cv<number>(s, "deposit.pct");
  const rate = i.cargoMode === "AMBIENT" ? cv<number>(s, "commission.ambient") : i.serviceClass === "PRO" ? cv<number>(s, "commission.pro") : cv<number>(s, "commission.standard");
  // Commission-secured minimum: whatever is paid in cash to the driver, the platform's cut + pass-through items are already collected online.
  const securedMin = r1000(freight * rate + ins.premium + vat + i.tipPre - discount * 0);
  let depositRequired = r1000(total * depositPct);
  if (i.terms === "PREPAID") depositRequired = total;
  if (i.terms === "CASH_BALANCE_TO_DRIVER") depositRequired = Math.min(total, Math.max(depositRequired, securedMin));
  depositRequired = Math.min(total, depositRequired);
  const freightOnline = depositRequired - ins.premium - vat - i.tipPre + discount;
  const cashAgreed = i.terms === "CASH_BALANCE_TO_DRIVER" ? Math.max(0, freight - freightOnline) : 0;
  return { freight, upliftPct, premium: ins.premium, coverage: ins.coverage, deductible: ins.deductible, productId: ins.productId, vat, tip: i.tipPre, discount, couponError, total, depositPct, depositRequired, securedMin, cashAgreed, commissionRate: rate };
}

export function cashEligibleShipper(s: State, shipperId: string, total: Rial) {
  const sh = shipperOf(s, shipperId);
  if (!cv<boolean>(s, "cash.enabled") || !sh?.controls.cashToDriver) return { ok: false as const, why: "پرداخت نقدی به راننده برای حساب شما فعال نیست." };
  if (total > cv<number>(s, "cash.maxOrder")) return { ok: false as const, why: "ارزش سفارش بیشتر از سقف مجاز پرداخت نقدی است." };
  const done = s.orders.filter((o) => o.shipperId === shipperId && ["COMPLETED", "DELIVERED"].includes(o.status)).length;
  if (done < 2) return { ok: false as const, why: "پرداخت نقدی برای حساب‌های جدید فعال نیست." };
  if (s.orders.some((o) => o.shipperId === shipperId && o.cash?.status === "mismatch")) return { ok: false as const, why: "اختلاف پرداخت نقدی باز دارید." };
  return { ok: true as const };
}

/* ───────────────────────── create ───────────────────────── */

const hash = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

function validateInput(s: State, shipperId: string, i: OrderInput): string | null {
  const sh = shipperOf(s, shipperId);
  if (!sh) return "ابتدا از ورودی صاحب بار وارد شوید.";
  if (sh.controls.blocked) return "حساب شما مسدود است؛ با پشتیبانی تماس بگیرید.";
  if (needsAcceptance(s, shipperId, "shipper")) return "ابتدا نسخه‌ی جاری قوانین را بپذیرید.";
  if (bal(s, A.shipperAr(shipperId)) > 0) return "بدهی تسویه‌نشده دارید؛ ابتدا از بخش کیف پول آن را پرداخت کنید.";
  if (!i.origin.city || !i.dest.city) return "مبدأ و مقصد را کامل کنید.";
  if (i.origin.city === i.dest.city && i.origin.address.trim() === i.dest.address.trim()) return "مبدأ و مقصد نمی‌توانند یکسان باشند.";
  if (!(i.weightKg > 0)) return "وزن بار را وارد کنید.";
  if (!(i.declaredValue >= 10_000_000)) return "ارزش اعلامی بار را وارد کنید (حداقل ۱ میلیون تومان).";
  if (!(i.freightBase >= 5_000_000)) return "کرایه‌ی پیشنهادی معتبر نیست.";
  if (i.cargoMode === "REFRIGERATED") {
    if (i.tempMin === undefined || i.tempMax === undefined || i.tempMin > i.tempMax) return "بازه‌ی دمایی معتبر نیست.";
    if (i.weightKg > VEHICLES[i.vehicleKind].capacityKg * 1.0 && i.weightKg > VEHICLES[i.vehicleKind].capacityKg) return "وزن بار با ظرفیت خودروی انتخابی نمی‌خواند.";
  }
  if (i.pickupTo <= i.pickupAt || i.deliverBy <= i.pickupTo) return "بازه‌ی بارگیری و مهلت تحویل را بررسی کنید.";
  if (i.serviceClass === "STANDARD" && i.assignMode !== "OPEN") return "برای انتخاب استخر پرو یا درخواست مستقیم، سرویس پرو را انتخاب کنید.";
  if (i.serviceClass === "PRO" && i.assignMode === "OPEN") return "سرویس پرو فقط برای رانندگان پرو نمایش داده می‌شود.";
  if (i.assignMode === "DIRECT") {
    const d = driverOf(s, i.directDriverId);
    if (!d || d.pro.status !== "pro") return "راننده‌ی انتخاب‌شده در دسترس نیست.";
    if (d.personId === shipperId) return "نمی‌توانید از خودتان درخواست بدهید.";
  }
  if (i.tipPre < 0) return "مبلغ انعام معتبر نیست.";
  if (!i.consignee.name.trim() || !/^09\d{9}$/.test(i.consignee.phone)) return "نام و موبایل گیرنده را وارد کنید.";
  return null;
}

export function createOrders(s: State, shipperId: string, input: OrderInput, templateId?: string): Result<{ ids: string[] }> {
  const err = validateInput(s, shipperId, input);
  if (err) return fail(err);
  const q = priceOrder(s, shipperId, input);
  if (q.couponError) return fail(q.couponError);
  if (input.terms === "CASH_BALANCE_TO_DRIVER") {
    const c = cashEligibleShipper(s, shipperId, q.total);
    if (!c.ok) return fail(c.why);
  }
  const groupId = uid(s, "g");
  const km = roadKm(input.origin, input.dest);
  const ids: string[] = [];
  const poolFor = (m: AssignMode): "OPEN" | "PRO_POOL" => (m === "OPEN" ? "OPEN" : "PRO_POOL");
  for (let n = 1; n <= input.count; n++) {
    const id = uid(s, "o");
    const o: Order = {
      id, groupId, groupIndex: n, groupSize: input.count, shipperId, status: "OPEN", pool: poolFor(input.assignMode),
      origin: input.origin, dest: input.dest, distanceKm: km,
      pickupAt: input.pickupAt, pickupTo: input.pickupTo, deliverBy: input.deliverBy,
      cargoMode: input.cargoMode, cargo: input.cargo, odor: input.odor, odorSensitive: input.odorSensitive,
      tempMin: input.cargoMode === "AMBIENT" ? undefined : input.tempMin, tempMax: input.cargoMode === "AMBIENT" ? undefined : input.tempMax,
      vehicleKind: input.vehicleKind, weightKg: input.weightKg, volumeM3: input.volumeM3, pallets: input.pallets,
      packaging: input.packaging, itemizedInvoice: input.itemizedInvoice, declaredValue: input.declaredValue, note: input.note, cleanOnly: input.cleanOnly,
      serviceClass: input.serviceClass, assignMode: input.assignMode,
      freight: q.freight, proUpliftPct: q.upliftPct,
      insurance: { productId: q.productId, premium: q.premium, coverage: q.coverage, deductible: q.deductible },
      tipPre: input.tipPre, tipPost: 0, discount: q.discount, couponCode: input.couponCode?.toUpperCase(), vat: q.vat,
      terms: input.terms, depositPct: q.depositPct, depositRequired: q.depositRequired,
      paid: { insurance: 0, vat: 0, tip: 0, freight: 0, waiting: 0 },
      autoPayDeposit: input.autoPayDeposit, cashAgreed: q.cashAgreed,
      cash: q.cashAgreed > 0 ? { status: "none" } : undefined,
      waitFee: 0,
      consignee: { name: input.consignee.name.trim(), phone: input.consignee.phone, token: `t${s.seq.toString(36)}${(hash(id) % 46656).toString(36)}`, otp: String(1000 + (hash(id + "otp") % 9000)) },
      waybills: [], media: [], events: [], templateId, createdAt: now(s),
    };
    o.events.push({ at: now(s), to: "OPEN", by: "صاحب بار", note: "ثبت سفارش" });
    s.orders.unshift(o);
    ids.push(id);
    publish(s, o);
  }
  return ok({ ids });
}

/** Put an order on the right board and tell the right people. */
function publish(s: State, o: Order) {
  if (o.assignMode === "OPEN") {
    o.status = "OPEN";
  } else if (o.assignMode === "PRO_POOL") {
    o.status = "PRO_POOL";
  } else if (o.assignMode === "DIRECT") {
    o.status = "DIRECT_REQUESTED";
    o.directExpiresAt = now(s) + cv<number>(s, "direct.windowMin") * MIN;
  } else {
    const d = smartPick(s, o);
    if (d) {
      o.status = "DIRECT_REQUESTED";
      o.directDriverId = d.personId;
      o.directExpiresAt = now(s) + 5 * MIN;
    } else {
      o.status = "PRO_POOL";
      o.pool = "PRO_POOL";
    }
  }
  o.events[o.events.length - 1].to = o.status;
  const link = (id: string) => `/driver/order/?id=${id}`;
  const route = `${o.origin.city} ← ${o.dest.city}`;
  if (o.status === "DIRECT_REQUESTED" && o.directDriverId) {
    notify(s, o.directDriverId, "driver", "direct", `درخواست مستقیم: ${route}. تا ${cv<number>(s, "direct.windowMin")} دقیقه فرصت پاسخ دارید.`, link(o.id));
    return;
  }
  let n = 0;
  for (const d of s.drivers) {
    if (n >= 25) break;
    if (claimBlock(s, d) || !eligibility(s, d, o).ok) continue;
    notify(s, d.personId, "driver", "new_order", `بار جدید: ${route}${o.tipPre ? " · با انعام" : ""}`, link(o.id));
    n++;
  }
}

export function resubmitToBoard(s: State, o: Order) {
  o.driverId = undefined;
  o.lockedBy = undefined;
  o.lockedUntil = undefined;
  o.depositDueAt = undefined;
  const st: OrderStatus = o.pool === "PRO_POOL" ? "PRO_POOL" : "OPEN";
  setStatus(s, o, st, SYSTEM);
}

/* ───────────────────────── claim → confirm → deposit ───────────────────────── */

export function claimOrder(s: State, driverId: string, orderId: string): Result {
  const o = orderOf(s, orderId);
  const d = driverOf(s, driverId);
  if (!o) return fail("سفارش پیدا نشد.");
  if (o.shipperId === driverId) return fail("شما نمی‌توانید سفارش ثبت‌شده‌ی خودتان را انتخاب کنید.");
  const block = claimBlock(s, d);
  if (block) return fail(block);
  if (o.status === "DIRECT_REQUESTED") return fail(o.directDriverId === driverId ? "این درخواست مستقیم است؛ از دکمه‌ی پذیرش استفاده کنید." : "این سفارش درخواست مستقیم برای راننده‌ی دیگری است.");
  if (!BOARD.includes(o.status)) return fail("این سفارش هم‌اکنون به راننده دیگری اختصاص یافته است.");
  const e = eligibility(s, d, o);
  if (!e.ok) {
    if (e.why in MATCH_FAIL_TEXT) return fail(MATCH_FAIL_TEXT[e.why as keyof typeof MATCH_FAIL_TEXT]);
    return fail(e.why);
  }
  if (s.orders.some((x) => x.status === "LOCKED" && x.lockedBy === driverId)) return fail("یک سفارش در انتظار تأیید شماست؛ ابتدا آن را نهایی یا رها کنید.");
  setStatus(s, o, "LOCKED", actorPerson(s, driverId), "انتخاب راننده");
  o.lockedBy = driverId;
  o.lockedUntil = now(s) + cv<number>(s, "lock.seconds") * 1000;
  return ok();
}

export function releaseLock(s: State, driverId: string, orderId: string): Result {
  const o = orderOf(s, orderId);
  if (!o || o.status !== "LOCKED" || o.lockedBy !== driverId) return fail("قفلی برای رها کردن وجود ندارد.");
  resubmitToBoard(s, o);
  return ok();
}

/** Driver confirms → deposit stage (or straight to ASSIGNED when the shipper auto-pays). */
export function confirmAssign(s: State, driverId: string, orderId: string): Result<{ status: OrderStatus }> {
  const o = orderOf(s, orderId);
  if (!o) return fail("سفارش پیدا نشد.");
  if (o.status !== "LOCKED" || o.lockedBy !== driverId || (o.lockedUntil ?? 0) <= now(s)) return fail("مهلت تأیید به پایان رسید و سفارش آزاد شد.");
  return ok({ status: startDepositStage(s, o, driverId) });
}

function startDepositStage(s: State, o: Order, driverId: string): OrderStatus {
  o.driverId = driverId;
  o.lockedBy = undefined;
  o.lockedUntil = undefined;
  o.directExpiresAt = undefined;
  setStatus(s, o, "AWAITING_DEPOSIT", actorPerson(s, driverId), "تأیید راننده");
  o.depositDueAt = now(s) + cv<number>(s, "deposit.dueMin") * MIN;
  const sh = shipperOf(s, o.shipperId);
  const due = Math.max(0, o.depositRequired - shipperPaid(o));
  if ((sh?.prefs.autoPayDeposit || o.autoPayDeposit) && due > 0 && shipperWallet(s, o.shipperId).available >= due) {
    pay(s, { payerId: o.shipperId, orderId: o.id, purpose: "deposit", amount: due, method: "wallet" });
  } else {
    notify(s, o.shipperId, "shipper", "deposit_due", `راننده انتخاب شد. تا ${cv<number>(s, "deposit.dueMin")} دقیقه بیعانه را پرداخت کنید وگرنه راننده آزاد می‌شود.`, `/app/order/?id=${o.id}`);
  }
  return o.status;
}

export function acceptDirect(s: State, driverId: string, orderId: string): Result<{ status: OrderStatus }> {
  const o = orderOf(s, orderId);
  const d = driverOf(s, driverId);
  if (!o || o.status !== "DIRECT_REQUESTED" || o.directDriverId !== driverId) return fail("این درخواست دیگر معتبر نیست.");
  if ((o.directExpiresAt ?? 0) <= now(s)) return fail("مهلت پاسخ به این درخواست تمام شده است.");
  const block = claimBlock(s, d);
  if (block) return fail(block);
  const e = eligibility(s, d, o);
  if (!e.ok) return fail(e.why in MATCH_FAIL_TEXT ? MATCH_FAIL_TEXT[e.why as keyof typeof MATCH_FAIL_TEXT] : e.why);
  return ok({ status: startDepositStage(s, o, driverId) });
}

export function declineDirect(s: State, driverId: string, orderId: string, reason = "مایل به انجام نیستم"): Result {
  const o = orderOf(s, orderId);
  if (!o || o.status !== "DIRECT_REQUESTED" || o.directDriverId !== driverId) return fail("درخواستی برای رد کردن نیست.");
  o.directDeclined = [...(o.directDeclined ?? []), driverId];
  o.events.push({ at: now(s), to: o.status, by: "راننده", note: `رد درخواست: ${reason}` });
  if (o.assignMode === "SMART") rotateSmart(s, o);
  else {
    o.directExpiresAt = now(s) - 1;
    notify(s, o.shipperId, "shipper", "direct_declined", `راننده درخواست مستقیم را نپذیرفت. یکی از گزینه‌های جایگزین را انتخاب کنید.`, `/app/order/?id=${o.id}`);
  }
  return ok();
}

function rotateSmart(s: State, o: Order) {
  const tried = o.directDeclined ?? [];
  const next = tried.length < 3 ? smartPick(s, o, tried) : undefined;
  if (next) {
    o.directDriverId = next.personId;
    o.directExpiresAt = now(s) + 5 * MIN;
    notify(s, next.personId, "driver", "direct", `درخواست تخصیص هوشمند: ${o.origin.city} ← ${o.dest.city}. تا ۵ دقیقه فرصت پاسخ دارید.`, `/driver/order/?id=${o.id}`);
  } else {
    o.directDriverId = undefined;
    o.directExpiresAt = undefined;
    o.pool = "PRO_POOL";
    setStatus(s, o, "PRO_POOL", SYSTEM, "راننده‌ی هوشمند پیدا نشد؛ آزادسازی به استخر پرو");
    notify(s, o.shipperId, "shipper", "smart_fallback", "راننده‌ی هوشمند پیدا نشد؛ سفارش به استخر پرو منتقل شد.", `/app/order/?id=${o.id}`);
  }
}

export function directFallback(s: State, shipperId: string, orderId: string, choice: "another" | "pro_pool" | "open", newDriverId?: string): Result {
  const o = orderOf(s, orderId);
  if (!o || o.shipperId !== shipperId || o.status !== "DIRECT_REQUESTED") return fail("این گزینه برای سفارش در دسترس نیست.");
  if (choice === "another") {
    const d = driverOf(s, newDriverId);
    if (!d || d.pro.status !== "pro" || d.personId === shipperId) return fail("راننده‌ی انتخاب‌شده در دسترس نیست.");
    o.directDriverId = d.personId;
    o.directExpiresAt = now(s) + cv<number>(s, "direct.windowMin") * MIN;
    notify(s, d.personId, "driver", "direct", `درخواست مستقیم: ${o.origin.city} ← ${o.dest.city}.`, `/driver/order/?id=${o.id}`);
    return ok();
  }
  o.directDriverId = undefined;
  o.directExpiresAt = undefined;
  if (choice === "pro_pool") {
    o.assignMode = "PRO_POOL";
    o.pool = "PRO_POOL";
    setStatus(s, o, "PRO_POOL", actorPerson(s, shipperId), "آزادسازی به استخر پرو");
  } else {
    o.assignMode = "OPEN";
    o.pool = "OPEN";
    o.serviceClass = "STANDARD";
    setStatus(s, o, "OPEN", actorPerson(s, shipperId), "آزادسازی به بازار باز");
  }
  publish(s, o);
  return ok();
}

/** Deposit window lapsed → the driver is released and the order returns to its board. */
function expireDeposit(s: State, o: Order) {
  const dp = o.driverId;
  const paid = shipperPaid(o);
  if (paid > 0) {
    post(s, { key: `depx:${o.id}:${s.seq}`, memo: "بازگشت پرداخت جزئی بیعانه", ref: { orderId: o.id }, lines: [[A.escrow(o.id), paid], [A.shipper(o.shipperId), -paid]] });
    o.paid = { insurance: 0, vat: 0, tip: 0, freight: 0, waiting: 0 };
  }
  if (dp) notify(s, dp, "driver", "released", `بیعانه‌ی سفارش ${o.origin.city} ← ${o.dest.city} پرداخت نشد؛ رزرو شما آزاد شد.`, "/driver/");
  notify(s, o.shipperId, "shipper", "deposit_expired", "مهلت پرداخت بیعانه تمام شد؛ سفارش دوباره برای رانندگان باز شد.", `/app/order/?id=${o.id}`);
  resubmitToBoard(s, o);
}

/* ───────────────────────── trip execution ───────────────────────── */

function mine(s: State, driverId: string, orderId: string, ...st: OrderStatus[]): Order | string {
  const o = orderOf(s, orderId);
  if (!o || o.driverId !== driverId) return "این سفر به حساب شما تعلق ندارد.";
  if (!st.includes(o.status)) return "در این مرحله امکان انجام این کار نیست.";
  return o;
}

export function startToPickup(s: State, driverId: string, orderId: string): Result {
  const o = mine(s, driverId, orderId, "ASSIGNED");
  if (typeof o === "string") return fail(o);
  const d = driverOf(s, driverId);
  const from = d?.lastLoc;
  const km = from ? roadKm(from, o.origin) : 25 + (hash(o.id) % 150);
  o.deadheadKm = km;
  o.departedAt = now(s);
  setStatus(s, o, "EN_ROUTE_TO_PICKUP", actorPerson(s, driverId), "حرکت به سمت مبدأ");
  notify(s, o.shipperId, "shipper", "en_route", `راننده به سمت مبدأ حرکت کرد (${Math.round(km)} کیلومتر تا بارگیری).`, `/app/order/?id=${o.id}`);
  return ok();
}

export function arrivePickup(s: State, driverId: string, orderId: string): Result {
  const o = mine(s, driverId, orderId, "EN_ROUTE_TO_PICKUP");
  if (typeof o === "string") return fail(o);
  o.arrivedPickupAt = now(s);
  setStatus(s, o, "AT_PICKUP", actorPerson(s, driverId), "رسیدن به مبدأ");
  notify(s, o.shipperId, "shipper", "at_pickup", "راننده به محل بارگیری رسید.", `/app/order/?id=${o.id}`);
  return ok();
}

export function waitFeeFor(s: State, from?: number, to?: number) {
  if (!from) return 0;
  const mins = ((to ?? now(s)) - from) / MIN;
  const over = mins - cv<number>(s, "waiting.freeMin");
  return over > 0 ? Math.ceil(over / 60) * cv<number>(s, "waiting.feePerHour") : 0;
}

export function startTrip(s: State, driverId: string, orderId: string, a: { cargo: Media; invoice: Media; items?: number }): Result {
  const o = mine(s, driverId, orderId, "AT_PICKUP");
  if (typeof o === "string") return fail(o);
  if (o.terms === "DEPOSIT_BALANCE_BEFORE_LOADING" && outstanding(o) > 0) return fail("صاحب بار هنوز مابقی کرایه را پرداخت نکرده است؛ بارگیری پس از پرداخت ممکن است.");
  if (o.terms === "PREPAID" && outstanding(o) > 0) return fail("پرداخت کامل کرایه انجام نشده است.");
  o.media.push(a.cargo, a.invoice);
  o.loadedAt = now(s);
  o.waitFee += waitFeeFor(s, o.arrivedPickupAt, o.loadedAt);
  setStatus(s, o, "IN_TRANSIT", actorPerson(s, driverId), "بارگیری انجام شد");
  notify(s, o.shipperId, "shipper", "in_transit", `بار شما ${o.origin.city} ← ${o.dest.city} بارگیری شد و در مسیر است.`, `/app/order/?id=${o.id}`);
  return ok();
}

export function arriveDelivery(s: State, driverId: string, orderId: string): Result {
  const o = mine(s, driverId, orderId, "IN_TRANSIT");
  if (typeof o === "string") return fail(o);
  o.arrivedDeliveryAt = now(s);
  setStatus(s, o, "AT_DELIVERY", actorPerson(s, driverId), "رسیدن به مقصد");
  notify(s, o.shipperId, "shipper", "at_delivery", "راننده به مقصد رسید؛ گیرنده کد تحویل را اعلام می‌کند.", `/app/order/?id=${o.id}`);
  return ok();
}

function chargeWaiting(s: State, o: Order) {
  const due = o.waitFee - o.paid.waiting;
  if (due <= 0) return;
  const w = shipperWallet(s, o.shipperId).available;
  const fromW = Math.min(w, due);
  const ar = due - fromW;
  const lines: [string, Rial][] = [[A.escrow(o.id), -due]];
  if (fromW > 0) lines.push([A.shipper(o.shipperId), fromW]);
  if (ar > 0) lines.push([A.shipperAr(o.shipperId), ar]);
  post(s, { key: `wait:${o.id}`, memo: "هزینه‌ی انتظار", ref: { orderId: o.id }, lines });
  o.paid.waiting += due;
  if (ar > 0) notify(s, o.shipperId, "shipper", "arrears", "هزینه‌ی انتظار به‌صورت بدهی ثبت شد؛ از بخش کیف پول تسویه کنید.", "/app/wallet/");
}

export function deliver(s: State, driverId: string, orderId: string, a: { otp: string; invoice: Media; items?: number; cashReceived?: Rial }): Result {
  const o = mine(s, driverId, orderId, "AT_DELIVERY");
  if (typeof o === "string") return fail(o);
  if (a.otp.trim() !== o.consignee.otp) return fail("کد تحویل گیرنده درست نیست. از گیرنده بخواهید کد را دوباره بخواند.");
  if (o.itemizedInvoice && !a.invoice.dataUrl) return fail("عکس فاکتور ریزمتن‌دار تحویل الزامی است.");
  o.media.push(a.invoice);
  const pickupInv = o.media.find((m) => m.kind === "invoice_pickup");
  if (pickupInv?.items !== undefined && a.invoice.items !== undefined && pickupInv.items !== a.invoice.items) {
    o.flag = { note: `مغایرت خودکار: ${pickupInv.items} قلم در مبدأ، ${a.invoice.items} قلم در مقصد`, by: "system", at: now(s), status: "open" };
  }
  o.deliveredAt = now(s);
  o.waitFee += waitFeeFor(s, o.arrivedDeliveryAt, o.deliveredAt);
  setStatus(s, o, "DELIVERED", actorPerson(s, driverId), "تحویل با کد گیرنده");
  chargeWaiting(s, o);
  if (o.cashAgreed > 0) {
    o.cash = { status: "pending", driverDeclared: a.cashReceived };
    if (a.cashReceived === undefined) return fail("مبلغ نقدی دریافت‌شده را وارد کنید.");
  }
  notify(s, o.shipperId, "shipper", "delivered", `بار شما در ${o.dest.city} تحویل شد. لطفاً به راننده امتیاز دهید.`, `/app/order/?id=${o.id}`);
  advanceAfterPayment(s, o);
  if (!o.settlement && outstanding(o) === 0) settleOrder(s, o);
  if (o.settlement && o.cash && o.cash.status === "pending") o.settlement.held = true;
  return ok();
}

/** Shipper confirms (or disputes) the cash handed to the driver. */
export function confirmCash(s: State, shipperId: string, orderId: string, amount: Rial): Result {
  const o = orderOf(s, orderId);
  if (!o || o.shipperId !== shipperId || !o.cash || o.cash.status === "none") return fail("پرداخت نقدی برای تأیید وجود ندارد.");
  o.cash.shipperConfirmed = amount;
  if (o.cash.driverDeclared === undefined) return ok();
  if (o.cash.driverDeclared === amount) {
    o.cash.status = "matched";
    if (o.settlement) o.settlement.held = false;
    return ok();
  }
  o.cash.status = "mismatch";
  if (o.settlement) o.settlement.held = true;
  const id = uid(s, "tk");
  s.tickets.unshift({
    id, channel: "finance", category: "اختلاف پرداخت نقدی", personId: shipperId, portal: "shipper", orderId, subject: "اختلاف در مبلغ پرداخت نقدی (MONEY_MISMATCH)",
    status: "OPEN", priority: "high", at: now(s), slaDueAt: now(s) + 4 * HOUR, linked: [],
    messages: [{ from: "system", text: `راننده ${o.cash.driverDeclared / 10} تومان و صاحب بار ${amount / 10} تومان اعلام کرده‌اند. وجه راننده تا بررسی نگه داشته شد.`, at: now(s) }],
    context: { سفارش: `${o.origin.city} ← ${o.dest.city}` },
  });
  if (o.driverId) notify(s, o.driverId, "driver", "cash_mismatch", "مبلغ نقدی اعلام‌شده با اظهار صاحب بار نمی‌خواند؛ پرونده‌ی مالی باز شد.", "/driver/wallet/");
  return ok();
}

/* ───────────────────────── cancellation ───────────────────────── */

export function cancelByShipper(s: State, shipperId: string, orderId: string, reason: string, refundTo: "wallet" | "card" = "wallet"): Result<{ fee: Rial }> {
  const o = orderOf(s, orderId);
  if (!o || o.shipperId !== shipperId) return fail("دسترسی ندارید.");
  if (isTerminal(o.status) || ["DELIVERED", "DISPUTED"].includes(o.status)) return fail("در این مرحله امکان لغو وجود ندارد.");
  const q = cancelQuote(s, o, "shipper");
  if (!q.allowed) return fail(q.title);
  const dp = o.driverId ?? o.lockedBy;
  cancelPostings(s, o, q, refundTo);
  o.cancel = { by: "shipper", at: now(s), reason, fee: q.fee, driverComp: q.driverComp, platformFee: q.platformFee, refund: q.refund };
  setStatus(s, o, "CANCELLED_BY_SHIPPER", actorPerson(s, shipperId), reason);
  o.lockedBy = undefined;
  o.lockedUntil = undefined;
  if (dp) notify(s, dp, "driver", "cancelled", `سفارش ${o.origin.city} ← ${o.dest.city} توسط صاحب بار لغو شد${q.driverComp ? ` و ${q.driverComp / 10} تومان جبران برای شما ثبت شد` : ""}.`, "/driver/trips/");
  return ok({ fee: q.fee });
}

export function cancelByDriver(s: State, driverId: string, orderId: string, reason: string): Result {
  const o = orderOf(s, orderId);
  if (!o || o.driverId !== driverId) return fail("این سفر به حساب شما تعلق ندارد.");
  if (!["AWAITING_DEPOSIT", "ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP"].includes(o.status)) return fail("در این مرحله امکان انصراف وجود ندارد.");
  const d = driverOf(s, driverId)!;
  const q = cancelQuote(s, o, "driver");
  cancelPostings(s, o, q, "wallet");
  const pts = cv<number>(s, "strike.driverCancel");
  d.strikes.push({ id: uid(s, "st"), at: now(s), kind: "cancel", points: pts, reason: `انصراف پس از تخصیص: ${reason}`, orderId });
  o.events.push({ at: now(s), to: o.status, by: "راننده", note: `انصراف: ${reason}` });
  o.redispatch = true;
  o.waybills = [];
  o.departedAt = undefined;
  o.arrivedPickupAt = undefined;
  o.assignedAt = undefined;
  resubmitToBoard(s, o);
  notify(s, o.shipperId, "shipper", "driver_cancelled", "راننده منصرف شد؛ مبلغ پرداختی کامل به کیف پول شما برگشت و سفارش با اولویت دوباره منتشر شد.", `/app/order/?id=${o.id}`);
  const total = d.strikes.reduce((n, x) => n + x.points, 0);
  if (total >= cv<number>(s, "strike.suspendAt")) {
    d.suspension = { reason: "تعلیق خودکار به‌دلیل امتیاز منفی", since: now(s), appeal: "none" };
    notify(s, driverId, "driver", "suspended", "حساب شما به‌دلیل امتیاز منفی معلق شد. می‌توانید درخواست تجدیدنظر ثبت کنید.", "/driver/profile/");
  }
  return ok();
}

export function reportShipperNotReady(s: State, driverId: string, orderId: string): Result {
  const o = mine(s, driverId, orderId, "AT_PICKUP");
  if (typeof o === "string") return fail(o);
  const waited = (now(s) - (o.arrivedPickupAt ?? now(s))) / MIN;
  if (waited < cv<number>(s, "waiting.freeMin")) return fail(`پس از ${cv<number>(s, "waiting.freeMin")} دقیقه انتظار می‌توانید «آماده نبودن بار» را گزارش کنید.`);
  o.waitFee += waitFeeFor(s, o.arrivedPickupAt, now(s));
  const q = cancelQuote(s, o, "not_ready");
  cancelPostings(s, o, q, "wallet");
  o.cancel = { by: "system", at: now(s), reason: "آماده نبودن بار در مبدأ", fee: q.fee, driverComp: q.driverComp, platformFee: q.platformFee, refund: q.refund };
  setStatus(s, o, "CANCELLED_BY_SHIPPER", actorPerson(s, driverId), "بار آماده نبود");
  const sh = shipperOf(s, o.shipperId);
  if (sh) sh.honesty = Math.max(0, sh.honesty - 6);
  notify(s, o.shipperId, "shipper", "not_ready", `سفارش به‌دلیل آماده نبودن بار لغو شد. جریمه: ${q.fee / 10} تومان.`, `/app/order/?id=${o.id}`);
  return ok();
}

export function adminCancel(s: State, actor: Actor, orderId: string, reason: string): Result {
  const o = orderOf(s, orderId);
  if (!o || isTerminal(o.status)) return fail("سفارش قابل لغو نیست.");
  const q = cancelQuote(s, o, "system");
  cancelPostings(s, o, q, "wallet");
  o.cancel = { by: "system", at: now(s), reason, fee: 0, driverComp: 0, platformFee: 0, refund: q.refund };
  setStatus(s, o, "CANCELLED_BY_SYSTEM", actor, reason);
  for (const p of [o.shipperId, o.driverId]) if (p) notify(s, p, p === o.shipperId ? "shipper" : "driver", "cancelled", `سفارش ${o.origin.city} ← ${o.dest.city} توسط پشتیبانی لغو شد.`);
  audit(s, actor, "order.cancel", reason, o.id);
  return ok();
}

/* ───────────────────────── boost & tips ───────────────────────── */

export function addBoost(s: State, shipperId: string, orderId: string, amount: Rial, method: "wallet" | "card" = "wallet"): Result {
  const o = orderOf(s, orderId);
  if (!o || o.shipperId !== shipperId) return fail("دسترسی ندارید.");
  if (!PRE_ASSIGN.includes(o.status) || o.status === "AWAITING_DEPOSIT") return fail("انعام جذب فقط پیش از تعیین راننده ممکن است.");
  if (amount < 1_000_000) return fail("حداقل انعام ۱۰۰ هزار تومان است.");
  o.tipPre += amount;
  const r = pay(s, { payerId: shipperId, orderId, purpose: "tip", amount, method });
  if (!r.ok) { o.tipPre -= amount; return r; }
  if (r.payment.status !== "SUCCEEDED") { o.tipPre -= amount; return fail("پرداخت انجام نشد. دوباره تلاش کنید."); }
  o.depositRequired = Math.min(totalDue(o), o.depositRequired + Math.round(amount * (o.terms === "PREPAID" ? 1 : 0)));
  return ok();
}

export function payPostTip(s: State, shipperId: string, orderId: string, amount: Rial): Result {
  const o = orderOf(s, orderId);
  if (!o || o.shipperId !== shipperId || !o.driverId) return fail("دسترسی ندارید.");
  if (!["DELIVERED", "COMPLETED"].includes(o.status) || !o.deliveredAt) return fail("انعام پس از تحویل بار ممکن است.");
  if (now(s) > o.deliveredAt + cv<number>(s, "tip.postWindowH") * HOUR) return fail("مهلت انعام این سفر تمام شده است.");
  if (amount < 1_000_000) return fail("حداقل انعام ۱۰۰ هزار تومان است.");
  if (shipperWallet(s, shipperId).available < amount) return fail("موجودی کیف پول کافی نیست؛ ابتدا کیف پول را شارژ کنید.");
  const comm = Math.round((amount * cv<number>(s, "commission.tips")) / 1000) * 1000;
  const to = o.settlement?.released ? A.dAvail(o.driverId) : A.dPending(o.driverId);
  post(s, { key: `tip:${o.id}:${s.seq}`, memo: "انعام پس از سفر", ref: { orderId: o.id, personId: o.driverId }, lines: [[A.shipper(shipperId), amount], [to, -(amount - comm)], ...(comm > 0 ? ([[A.REV_COMM, -comm]] as [string, Rial][]) : [])] });
  o.tipPost += amount;
  if (o.settlement && !o.settlement.released) o.settlement.driverNet += amount - comm;
  notify(s, o.driverId, "driver", "tip", `انعام ${amount / 10} تومانی از صاحب بار دریافت کردید. ممنون از زحمت شما!`, "/driver/wallet/");
  return ok();
}

/* ───────────────────────── mismatch ───────────────────────── */

const CARGO_FACTOR: Record<CargoKind, number> = { dairy: 1, produce: 0.95, dry: 0.9, meat: 1.08, fish: 1.12, icecream: 1.12, pharma: 1.2, other: 1 };

export interface MismatchInput {
  types: MismatchType[];
  actual: Mismatch["actual"];
  photos: Media[];
  adjustPct?: number;
}

export function mismatchFormula(s: State, o: Order, i: MismatchInput) {
  const lines: { label: string; amount: Rial }[] = [];
  const perKg = o.freight / Math.max(1, o.weightKg);
  const a = i.actual;
  if (i.types.includes("weight_up") && a.weightKg && a.weightKg > o.weightKg) {
    const delta = a.weightKg - o.weightKg;
    lines.push({ label: `افزایش وزن ${delta} کیلوگرم × سهم هر کیلو`, amount: r1000(delta * perKg) });
  }
  if (i.types.includes("quantity_down") && a.weightKg && a.weightKg < o.weightKg) {
    const delta = o.weightKg - a.weightKg;
    lines.push({ label: `کاهش وزن ${delta} کیلوگرم (۸۰٪ سهم هر کیلو)`, amount: -r1000(delta * perKg * 0.8) });
  }
  if (i.types.includes("volume_up") && a.volumeM3 && o.volumeM3 && a.volumeM3 > o.volumeM3) lines.push({ label: "افزایش حجم", amount: r1000(o.freight * Math.min(0.2, (a.volumeM3 / o.volumeM3 - 1) * 0.3)) });
  if (i.types.includes("pallets_up") && a.pallets && o.pallets && a.pallets > o.pallets) lines.push({ label: `${a.pallets - o.pallets} پالت اضافه`, amount: r1000(o.freight * 0.03 * (a.pallets - o.pallets)) });
  if (i.types.includes("cargo_type") && a.cargo) lines.push({ label: "تفاوت نوع بار", amount: r1000(o.freight * (CARGO_FACTOR[a.cargo] / CARGO_FACTOR[o.cargo] - 1)) });
  if (i.types.includes("temperature") && a.tempMax !== undefined && o.tempMax !== undefined && a.tempMax < o.tempMax) lines.push({ label: "نیاز به دمای سردتر", amount: r1000(o.freight * 0.1) });
  if (i.types.includes("packaging")) lines.push({ label: "هزینه‌ی بسته‌بندی/جابه‌جایی اضافه", amount: r1000(o.freight * 0.03) });
  if (i.types.includes("odor_hazard")) lines.push({ label: "بوی شدید/خطر (نظافت و تهویه)", amount: r1000(o.freight * 0.05) });
  const sum = lines.reduce((n, l) => n + l.amount, 0);
  const suggested = Math.max(Math.round(o.freight * 0.5), o.freight + sum);
  return { lines, suggested };
}

export function reportMismatch(s: State, driverId: string, orderId: string, i: MismatchInput): Result<{ id: string }> {
  const o = mine(s, driverId, orderId, "AT_PICKUP");
  if (typeof o === "string") return fail(o);
  if (!i.types.length) return fail("نوع مغایرت را انتخاب کنید.");
  if (i.photos.length < 2) return fail("حداقل دو عکس به‌عنوان مدرک لازم است.");
  const f = mismatchFormula(s, o, i);
  const pct = cv<number>(s, "mismatch.adjustPct");
  const wanted = i.adjustPct !== undefined ? f.suggested * (1 + Math.max(-pct, Math.min(pct, i.adjustPct))) : f.suggested;
  const proposed = r1000(wanted);
  const ratio = i.actual.weightKg ? i.actual.weightKg / o.weightKg : 1;
  const m: Mismatch = {
    id: uid(s, "mm"), orderId, driverId, shipperId: o.shipperId, at: now(s), types: i.types, actual: i.actual, photos: i.photos,
    formula: [{ label: "کرایه‌ی فعلی", amount: o.freight }, ...f.lines], suggestedFreight: f.suggested, proposedFreight: proposed,
    newDeclaredValue: r1000(o.declaredValue * Math.max(ratio, 0.1)), status: "PENDING_SHIPPER", dueAt: now(s) + cv<number>(s, "mismatch.slaMin") * MIN,
  };
  s.mismatches.unshift(m);
  o.mismatchId = m.id;
  setStatus(s, o, "MISMATCH_REVIEW", actorPerson(s, driverId), "گزارش مغایرت بار");
  notify(s, o.shipperId, "shipper", "mismatch", `⚠ مغایرت بار گزارش شد. تا ${cv<number>(s, "mismatch.slaMin")} دقیقه برای تصمیم فرصت دارید.`, `/app/order/?id=${o.id}`);
  return ok({ id: m.id });
}

function applyMismatch(s: State, o: Order, m: Mismatch, freight: Rial): Result<{ delta: Rial; needsPayment: boolean }> {
  const old = { freight: o.freight, premium: o.insurance.premium };
  const ratio = m.actual.weightKg ? m.actual.weightKg / o.weightKg : 1;
  if (m.actual.weightKg) o.weightKg = m.actual.weightKg;
  if (m.actual.volumeM3) o.volumeM3 = m.actual.volumeM3;
  if (m.actual.pallets) o.pallets = m.actual.pallets;
  if (m.actual.cargo) o.cargo = m.actual.cargo;
  if (m.actual.odor) o.odor = m.actual.odor;
  o.declaredValue = m.newDeclaredValue || r1000(o.declaredValue * ratio);
  o.freight = freight;
  const covPct = o.insurance.coverage && old.premium ? o.insurance.coverage / Math.max(1, o.declaredValue / ratio) : 1;
  const ins = insurancePremium(s, o.insurance.productId, o.declaredValue, covPct || 1);
  o.insurance = { productId: ins.productId, premium: ins.premium, coverage: ins.coverage, deductible: ins.deductible };
  const vatRate = cv<number>(s, "vat.rate");
  o.vat = r1000((cv<boolean>(s, "vat.onFeesOnly") ? o.insurance.premium : o.freight + o.insurance.premium + o.tipPre) * vatRate);
  const total = totalDue(o);
  const dep = o.terms === "PREPAID" ? total : r1000(total * o.depositPct);
  o.depositRequired = o.terms === "CASH_BALANCE_TO_DRIVER" ? Math.min(total, Math.max(dep, r1000(o.freight * commissionRate(s, o) + o.insurance.premium + o.vat + o.tipPre))) : dep;
  if (o.cashAgreed > 0) o.cashAgreed = Math.max(0, o.freight - (o.depositRequired - o.insurance.premium - o.vat - o.tipPre + (o.discountPosted ? o.discount : 0)));
  issueWaybill(s, o, `اصلاح پس از مغایرت (${m.types.join("، ")})`);
  const delta = o.freight + o.insurance.premium - old.freight - old.premium;
  // Paid more than now required → refund the excess to the wallet.
  const over = shipperPaid(o) - totalDue(o);
  if (over > 0) {
    post(s, { key: `mmref:${m.id}`, memo: "بازگشت مازاد پس از اصلاح مغایرت", ref: { orderId: o.id }, lines: [[A.escrow(o.id), over], [A.shipper(o.shipperId), -over]] });
    o.paid.freight = Math.max(0, o.paid.freight - over);
  }
  const need = Math.max(0, o.depositRequired - shipperPaid(o));
  return ok({ delta, needsPayment: need > 0 });
}

function proceedAfterMismatch(s: State, o: Order, m: Mismatch) {
  m.status = "APPROVED";
  setStatus(s, o, "AT_PICKUP", SYSTEM, "مغایرت تأیید شد؛ ادامه‌ی بارگیری");
  if (o.driverId) notify(s, o.driverId, "driver", "mismatch_ok", "مغایرت تأیید شد. بارنامه‌ی نسخه‌ی جدید صادر شد؛ بارگیری را ادامه دهید.", `/driver/trip/?id=${o.id}`);
}

export function respondMismatch(s: State, shipperId: string, mmId: string, action: "approve" | "counter" | "reject", counterFreight?: Rial): Result<{ needsPayment?: boolean; delta?: Rial }> {
  const m = s.mismatches.find((x) => x.id === mmId);
  const o = orderOf(s, m?.orderId);
  if (!m || !o || o.shipperId !== shipperId) return fail("پرونده پیدا نشد.");
  if (!["PENDING_SHIPPER", "ESCALATED"].includes(m.status)) return fail("این مغایرت قبلاً تعیین تکلیف شده است.");
  if (action === "counter") {
    if (m.counter) return fail("فقط یک پیشنهاد متقابل مجاز است.");
    if (!counterFreight || counterFreight < Math.round(o.freight * 0.5)) return fail("مبلغ پیشنهادی معتبر نیست.");
    m.counter = { freight: counterFreight, at: now(s) };
    m.status = "COUNTERED";
    m.dueAt = now(s) + cv<number>(s, "mismatch.slaMin") * MIN;
    notify(s, m.driverId, "driver", "mismatch_counter", `صاحب بار پیشنهاد متقابل داد: ${counterFreight / 10} تومان.`, `/driver/trip/?id=${o.id}`);
    return ok();
  }
  if (action === "reject") return rejectMismatch(s, o, m, actorPerson(s, shipperId));
  const r = applyMismatch(s, o, m, m.proposedFreight);
  if (!r.ok) return r;
  if (!r.needsPayment) proceedAfterMismatch(s, o, m);
  else m.status = "APPROVED";
  return ok({ needsPayment: r.needsPayment, delta: r.delta });
}

function rejectMismatch(s: State, o: Order, m: Mismatch, by: Actor): Result {
  const deadhead = Math.min(cv<number>(s, "cancel.deadheadCap"), Math.round((o.deadheadKm ?? 0) * cv<number>(s, "cancel.deadheadPerKm")));
  const paid = shipperPaid(o);
  const fee = Math.min(deadhead, paid);
  const plat = Math.round((fee * cv<number>(s, "cancel.platformCut")) / 1000) * 1000;
  cancelPostings(s, o, { tier: "departed", title: "", fee, driverComp: fee - plat, platformFee: plat, refund: paid - fee, extra: 0, rows: [], allowed: true }, "wallet");
  m.status = "REJECTED";
  m.decision = { by: by.label, at: now(s), note: "رد شد؛ سفر لغو شد" };
  o.cancel = { by: "shipper", at: now(s), reason: "رد مغایرت بار", fee, driverComp: fee - plat, platformFee: plat, refund: paid - fee };
  setStatus(s, o, "CANCELLED_BY_SHIPPER", by, "رد مغایرت");
  const sh = shipperOf(s, o.shipperId);
  if (sh) sh.honesty = Math.max(0, sh.honesty - 8);
  notify(s, m.driverId, "driver", "mismatch_rejected", `صاحب بار مغایرت را نپذیرفت؛ سفر لغو و جبران رفت خالی (${fee / 10} تومان) ثبت شد.`, "/driver/wallet/");
  return ok();
}

export function driverRespondCounter(s: State, driverId: string, mmId: string, accept: boolean): Result<{ needsPayment?: boolean }> {
  const m = s.mismatches.find((x) => x.id === mmId);
  const o = orderOf(s, m?.orderId);
  if (!m || !o || m.driverId !== driverId || m.status !== "COUNTERED" || !m.counter) return fail("پیشنهادی برای پاسخ وجود ندارد.");
  if (!accept) return escalateMismatch(s, mmId, "راننده پیشنهاد متقابل را نپذیرفت");
  const r = applyMismatch(s, o, m, m.counter.freight);
  if (!r.ok) return r;
  if (!r.needsPayment) proceedAfterMismatch(s, o, m);
  else m.status = "APPROVED";
  return ok({ needsPayment: r.needsPayment });
}

/** After the shipper approved but still owed the difference: pay it and unblock loading. */
export function payMismatchDelta(s: State, shipperId: string, orderId: string, method: "wallet" | "card" | "split" = "wallet"): Result {
  const o = orderOf(s, orderId);
  if (!o || o.shipperId !== shipperId) return fail("دسترسی ندارید.");
  const m = s.mismatches.find((x) => x.id === o.mismatchId);
  if (!m || o.status !== "MISMATCH_REVIEW" || m.status !== "APPROVED") return fail("مابه‌التفاوتی برای پرداخت وجود ندارد.");
  const need = Math.max(0, o.depositRequired - shipperPaid(o));
  if (need > 0) {
    const r = pay(s, { payerId: shipperId, orderId, purpose: "mismatch_delta", amount: need, method });
    if (!r.ok) return r;
    if (r.payment.status !== "SUCCEEDED") return fail(r.payment.failReason ?? "پرداخت هنوز تأیید نشده است.");
  }
  proceedAfterMismatch(s, o, m);
  return ok();
}

export function escalateMismatch(s: State, mmId: string, reason: string): Result<never> | Result {
  const m = s.mismatches.find((x) => x.id === mmId);
  const o = orderOf(s, m?.orderId);
  if (!m || !o) return fail("پرونده پیدا نشد.");
  if (m.status === "ESCALATED") return ok();
  m.status = "ESCALATED";
  const id = uid(s, "tk");
  m.ticketId = id;
  s.tickets.unshift({
    id, channel: "trip", category: "مغایرت بار", personId: o.shipperId, portal: "shipper", orderId: o.id, subject: `مغایرت بار ${o.origin.city} ← ${o.dest.city}`,
    status: "ESCALATED", priority: "high", at: now(s), slaDueAt: now(s) + HOUR, linked: [m.id],
    messages: [{ from: "system", text: `ارجاع خودکار به پشتیبانی: ${reason}.`, at: now(s) }], context: { سفارش: o.id },
  });
  for (const p of [o.shipperId, o.driverId]) if (p) notify(s, p, p === o.shipperId ? "shipper" : "driver", "mismatch_escalated", "پرونده‌ی مغایرت به پشتیبانی ارجاع شد و به‌صورت زنده بررسی می‌شود.", p === o.shipperId ? `/app/order/?id=${o.id}` : `/driver/trip/?id=${o.id}`);
  return ok();
}

export function resolveMismatch(s: State, actor: Actor, mmId: string, outcome: "driver" | "shipper" | "split", note: string): Result {
  const m = s.mismatches.find((x) => x.id === mmId);
  const o = orderOf(s, m?.orderId);
  if (!m || !o || !["ESCALATED", "PENDING_SHIPPER", "COUNTERED"].includes(m.status)) return fail("این پرونده قابل تصمیم‌گیری نیست.");
  m.decision = { by: actor.label, at: now(s), note };
  if (outcome === "shipper") {
    m.status = "RESOLVED_SHIPPER";
    const d = driverOf(s, m.driverId);
    if (d) {
      d.strikes.push({ id: uid(s, "st"), at: now(s), kind: "behavior", points: 3, reason: "گزارش مغایرت نادرست (حکم پشتیبانی)", orderId: o.id });
    }
    const paid = shipperPaid(o);
    cancelPostings(s, o, cancelQuote(s, o, "driver"), "wallet");
    void paid;
    o.redispatch = true;
    resubmitToBoard(s, o);
    notify(s, o.shipperId, "shipper", "mismatch_resolved", "پشتیبانی به نفع شما رأی داد؛ بیعانه برگشت و سفارش دوباره منتشر شد.", `/app/order/?id=${o.id}`);
  } else {
    const freight = outcome === "driver" ? m.proposedFreight : r1000((o.freight + m.proposedFreight) / 2);
    const r = applyMismatch(s, o, m, freight);
    if (!r.ok) return r;
    m.status = outcome === "driver" ? "RESOLVED_DRIVER" : "SPLIT";
    // Staff decision: the difference is collected from the wallet if possible, otherwise held as arrears.
    const need = Math.max(0, o.depositRequired - shipperPaid(o));
    if (need > 0) {
      const w = shipperWallet(s, o.shipperId).available;
      const fromW = Math.min(w, need);
      const ar = need - fromW;
      const lines: [string, Rial][] = [[A.escrow(o.id), -need]];
      if (fromW) lines.push([A.shipper(o.shipperId), fromW]);
      if (ar) lines.push([A.shipperAr(o.shipperId), ar]);
      post(s, { key: `mmres:${m.id}`, memo: "مابه‌التفاوت مغایرت (حکم پشتیبانی)", ref: { orderId: o.id }, lines });
      o.paid.freight += need;
    }
    setStatus(s, o, "AT_PICKUP", actor, "تصمیم پشتیبانی درباره‌ی مغایرت");
    if (o.driverId) notify(s, o.driverId, "driver", "mismatch_resolved", "پشتیبانی درباره‌ی مغایرت تصمیم گرفت؛ بارگیری را ادامه دهید.", `/driver/trip/?id=${o.id}`);
  }
  const t = s.tickets.find((x) => x.id === m.ticketId);
  if (t) { t.status = "RESOLVED"; t.messages.push({ from: "agent", by: actor.label, text: `نتیجه: ${note}`, at: now(s) }); }
  audit(s, actor, "mismatch.resolve", `${outcome}: ${note}`, m.id);
  return ok();
}

/* ───────────────────────── tick ───────────────────────── */

export function tickDue(s: State): boolean {
  const t = now(s);
  const revealMs = cv<number>(s, "review.revealDays") * DAY;
  for (const c of s.config.scheduled) if (!c.applied && c.effectiveAt <= t) return true;
  for (const o of s.orders) {
    if (o.status === "LOCKED" && (o.lockedUntil ?? 0) <= t) return true;
    if (o.status === "AWAITING_DEPOSIT" && (o.depositDueAt ?? 0) <= t) return true;
    if (o.status === "DIRECT_REQUESTED" && o.directExpiresAt && o.directExpiresAt <= t && (o.assignMode === "SMART" || cv<boolean>(s, "match.directFallbackAuto"))) return true;
    if (BOARD.includes(o.status) && o.pickupTo < t - 2 * HOUR) return true;
    if (o.settlement && !o.settlement.released && !o.settlement.held && o.settlement.releaseAt <= t) return true;
  }
  for (const m of s.mismatches) if ((m.status === "PENDING_SHIPPER" || m.status === "COUNTERED") && m.dueAt <= t) return true;
  for (const p of s.payments) if (p.status === "PROCESSING" && p.settleAt && p.settleAt <= t) return true;
  for (const r of s.reviews) if (!r.revealed && r.at + revealMs <= t) return true;
  for (const tp of s.templates) if (tp.active && tp.nextRunAt - 12 * HOUR <= t) return true;
  for (const d of s.debts) if (d.status === "OPEN" && ladderStage(s, d) > d.stage) return true;
  return false;
}

function ladderStage(s: State, d: { at: number }): 0 | 1 | 2 | 3 | 4 {
  const h = (now(s) - d.at) / HOUR;
  if (h >= cv<number>(s, "debt.stage4Hours")) return 4;
  if (h >= cv<number>(s, "debt.stage2Hours") * 1.5) return 3;
  if (h >= cv<number>(s, "debt.stage2Hours")) return 2;
  if (h >= cv<number>(s, "debt.stage1Hours")) return 1;
  return 0;
}

export function engineTick(s: State): boolean {
  const t = now(s);
  let changed = applyScheduledConfig(s, t) > 0;
  for (const o of s.orders) {
    if (o.status === "LOCKED" && (o.lockedUntil ?? 0) <= t) {
      if (o.lockedBy) notify(s, o.lockedBy, "driver", "released", "مهلت تأیید سفارش تمام شد و سفارش دوباره آزاد شد.", "/driver/");
      resubmitToBoard(s, o);
      changed = true;
    } else if (o.status === "AWAITING_DEPOSIT" && (o.depositDueAt ?? 0) <= t) {
      expireDeposit(s, o);
      changed = true;
    } else if (o.status === "DIRECT_REQUESTED" && o.directExpiresAt && o.directExpiresAt <= t) {
      if (o.assignMode === "SMART") { o.directDeclined = [...(o.directDeclined ?? []), o.directDriverId ?? ""]; rotateSmart(s, o); changed = true; }
      else if (cv<boolean>(s, "match.directFallbackAuto")) { directFallback(s, o.shipperId, o.id, "pro_pool"); changed = true; }
    } else if (BOARD.includes(o.status) && o.pickupTo < t - 2 * HOUR) {
      setStatus(s, o, "EXPIRED", SYSTEM, "گذشتن زمان بارگیری");
      notify(s, o.shipperId, "shipper", "expired", `سفارش ${o.origin.city} ← ${o.dest.city} بدون راننده منقضی شد.`, `/app/order/?id=${o.id}`);
      changed = true;
    }
    if (o.settlement && !o.settlement.released && !o.settlement.held && o.settlement.releaseAt <= t) {
      releaseSettlement(s, o);
      changed = true;
    }
  }
  for (const m of s.mismatches) {
    if ((m.status === "PENDING_SHIPPER" || m.status === "COUNTERED") && m.dueAt <= t) { escalateMismatch(s, m.id, "پاسخی در مهلت دریافت نشد"); changed = true; }
  }
  if (settleDelayed(s)) changed = true;
  const revealMs = cv<number>(s, "review.revealDays") * DAY;
  for (const r of s.reviews) if (!r.revealed && r.at + revealMs <= t) { r.revealed = true; changed = true; }
  for (const tp of s.templates) {
    while (tp.active && tp.nextRunAt - 12 * HOUR <= t) { spawnFromTemplate(s, tp); changed = true; }
  }
  for (const d of s.debts) {
    if (d.status !== "OPEN") continue;
    const st = ladderStage(s, d);
    if (st > d.stage) {
      d.stage = st;
      d.reminders += st === 1 ? 1 : 0;
      notify(s, d.driverId, "driver", "debt", st === 1 ? "یادآوری: بدهی کارمزد شما هنوز تسویه نشده است." : st === 2 ? "برای ادامه‌ی دریافت بار، کیف پول را شارژ و بدهی را تسویه کنید." : st === 4 ? "حساب شما به‌دلیل بدهی کارمزد معلق می‌شود." : "پرونده‌ی بدهی شما به مدیر مالی ارجاع شد.", "/driver/wallet/");
      if (st === 4) {
        const dp = driverOf(s, d.driverId);
        if (dp && !dp.suspension) dp.suspension = { reason: "بدهی کارمزد تسویه‌نشده", since: t, appeal: "none" };
      }
      changed = true;
    }
  }
  return changed;
}

export function spawnFromTemplate(s: State, tp: State["templates"][number]) {
  const input: OrderInput = { ...tp.draft, pickupAt: tp.nextRunAt, pickupTo: tp.nextRunAt + tp.windowMs, deliverBy: tp.nextRunAt + tp.deliverAfterMs };
  createOrders(s, tp.shipperId, input, tp.id);
  tp.nextRunAt += tp.cadence === "daily" ? DAY : 7 * DAY;
}

export { completePayment };
export type { OdorClass };
export const ACTIVE = ACTIVE_TRIP;
void cashEligibleDriver;
void matchVehicle;

/* ───────────────────────── recurring templates ───────────────────────── */

export function saveTemplate(s: State, shipperId: string, input: OrderInput, cadence: "daily" | "weekly"): Result<{ id: string }> {
  const { pickupAt, pickupTo, deliverBy, ...draft } = input;
  const id = uid(s, "tp");
  s.templates.push({ id, shipperId, cadence, hour: new Date(pickupAt).getHours(), active: true, nextRunAt: pickupAt + (cadence === "daily" ? DAY : 7 * DAY), windowMs: pickupTo - pickupAt, deliverAfterMs: deliverBy - pickupAt, draft });
  return ok({ id });
}
