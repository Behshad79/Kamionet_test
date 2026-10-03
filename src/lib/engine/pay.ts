import { A, bal, post, shipperWallet } from "../ledger";
import type { Buckets, Coupon, Order, Payment, PaymentMethod, PaymentPurpose, Rial, State, WaybillVersion } from "../types";
import { actorPerson, audit, cv, DAY, driverOf, fail, HOUR, MIN, notify, now, ok, orderOf, paidTotal, person, setStatus, shipperOf, SYSTEM, uid, type Result } from "./core";

/* ───────────────────────── required / outstanding ───────────────────────── */

export const caps = (o: Order): Buckets => ({
  insurance: o.insurance.premium,
  vat: o.vat,
  tip: o.tipPre,
  freight: o.freight,
  waiting: o.waitFee,
});

/** What the shipper must pay in total (after platform-funded discount). */
export const totalDue = (o: Order) => o.freight + o.insurance.premium + o.vat + o.tipPre - o.discount;
/** Shipper's own money paid in (platform-funded discount excluded). */
export const shipperPaid = (o: Order) => paidTotal(o) - (o.discountPosted ? o.discount : 0);
export const outstanding = (o: Order) => Math.max(0, totalDue(o) - shipperPaid(o));

function allocate(o: Order, amount: Rial) {
  const c = caps(o);
  const order: (keyof Buckets)[] = ["insurance", "vat", "tip", "freight", "waiting"];
  let left = amount;
  for (const k of order) {
    const room = Math.max(0, c[k] - o.paid[k]);
    const put = Math.min(room, left);
    o.paid[k] += put;
    left -= put;
  }
  if (left > 0) o.paid.freight += left; // overpayment stays with the freight bucket until refunded by the caller
}

/* ───────────────────────── waybill ───────────────────────── */

export function issueWaybill(s: State, o: Order, reason: string) {
  const prev = o.waybills[o.waybills.length - 1];
  if (prev) prev.supersededAt = now(s);
  const w: WaybillVersion = {
    v: (prev?.v ?? 0) + 1,
    at: now(s),
    reason,
    weightKg: o.weightKg,
    volumeM3: o.volumeM3,
    pallets: o.pallets,
    cargo: o.cargo,
    declaredValue: o.declaredValue,
    freight: o.freight,
    insurancePremium: o.insurance.premium,
  };
  o.waybills.push(w);
  return w;
}

/* ───────────────────────── coupons ───────────────────────── */

export interface CouponCtx {
  total: Rial;
  route: string;
  vehicleKind: Order["vehicleKind"];
  cargoMode: Order["cargoMode"];
  serviceClass: Order["serviceClass"];
}

export function couponDiscount(s: State, personId: string, code: string, ctx: CouponCtx): Result<{ discount: Rial; coupon: Coupon }> {
  const c = s.coupons.find((x) => x.code === code.trim().toUpperCase());
  const sh = shipperOf(s, personId);
  if (!c) return fail("کد تخفیف معتبر نیست.");
  if (sh && !sh.controls.couponEligible) return fail("حساب شما مجاز به استفاده از کد تخفیف نیست.");
  const t = now(s);
  if (c.paused) return fail("این کد موقتاً غیرفعال است.");
  if (t < c.start) return fail("زمان استفاده از این کد هنوز شروع نشده است.");
  if (t > c.end) return fail("مهلت این کد تمام شده است.");
  if (c.redemptions.length >= c.totalLimit) return fail("ظرفیت استفاده از این کد تمام شده است.");
  if (c.redemptions.filter((r) => r.personId === personId).length >= c.perUser) return fail("شما قبلاً از این کد استفاده کرده‌اید.");
  if (c.minOrder && ctx.total < c.minOrder) return fail("مبلغ سفارش کمتر از حداقل مجاز این کد است.");
  if (c.firstOrderOnly && s.orders.some((o) => o.shipperId === personId && !["CANCELLED_BY_SHIPPER", "EXPIRED", "CANCELLED_BY_SYSTEM"].includes(o.status))) return fail("این کد فقط برای اولین سفارش است.");
  if (c.routes && !c.routes.includes(ctx.route)) return fail("این کد برای این مسیر معتبر نیست.");
  if (c.vehicleKinds && !c.vehicleKinds.includes(ctx.vehicleKind)) return fail("این کد برای این نوع خودرو معتبر نیست.");
  if (c.cargoModes && !c.cargoModes.includes(ctx.cargoMode)) return fail("این کد برای این نوع بار معتبر نیست.");
  if (c.serviceClass && c.serviceClass !== ctx.serviceClass) return fail(`این کد فقط برای سرویس ${c.serviceClass === "PRO" ? "پرو" : "معمولی"} است.`);
  if (c.segment === "enterprise" && !(sh && sh.controls.creditTermsDays > 0)) return fail("این کد مخصوص مشتریان سازمانی است.");
  let d = c.kind === "PCT" ? Math.round((ctx.total * c.value) / 1000) * 1000 : c.value;
  if (c.maxDiscount) d = Math.min(d, c.maxDiscount);
  d = Math.min(d, ctx.total);
  return ok({ discount: d, coupon: c });
}

/* ───────────────────────── payments ───────────────────────── */

const settleDelayMs = 2 * MIN;

/** Walk open debts oldest-first and reduce them; clears the collection ladder when paid. */
export function applyDebtPayment(s: State, driverId: string, amount: Rial) {
  let left = amount;
  for (const d of s.debts.filter((x) => x.driverId === driverId && x.status === "OPEN").sort((a, b) => a.at - b.at)) {
    const cut = Math.min(left, d.remaining);
    d.remaining -= cut;
    left -= cut;
    if (d.remaining === 0) d.status = "PAID";
  }
  const dp = driverOf(s, driverId);
  if (dp?.suspension?.reason === "بدهی کارمزد تسویه‌نشده" && !s.debts.some((x) => x.driverId === driverId && x.status === "OPEN")) dp.suspension = undefined;
}

export function newPayment(s: State, p: Omit<Payment, "id" | "at" | "refunded" | "idemKey" | "status"> & { status?: Payment["status"]; idemKey?: string }): Payment {
  const id = uid(s, "pay");
  const pay: Payment = { id, at: now(s), refunded: 0, idemKey: p.idemKey ?? `pay:${id}`, status: p.status ?? "PENDING", ...p };
  s.payments.unshift(pay);
  return pay;
}

/** Posts the money for a SUCCEEDED payment (idempotent per payment id) and advances the order if relevant. */
export function completePayment(s: State, pay: Payment): void {
  if (pay.status === "SUCCEEDED" && s.txKeys[`pay:${pay.id}:done`]) return;
  const o = pay.orderId ? orderOf(s, pay.orderId) : undefined;
  const refs = { paymentId: pay.id, orderId: pay.orderId, personId: pay.payerId };
  const fromAccount = pay.method === "card2card" || pay.method === "paya" ? A.BANK : A.GATEWAY;
  if (pay.purpose === "topup") {
    post(s, { key: `pay:${pay.id}:c`, memo: "شارژ کیف پول", ref: refs, lines: [[fromAccount, pay.amount], [A.shipper(pay.payerId), -pay.amount]] });
  } else if (pay.purpose === "debt") {
    post(s, { key: `pay:${pay.id}:c`, memo: "پرداخت بدهی کارمزد", ref: refs, lines: [[fromAccount, pay.amount], [A.dDebt(pay.payerId), -pay.amount]] });
    applyDebtPayment(s, pay.payerId, pay.amount);
  } else if (o) {
    if (!o.discountPosted && o.discount > 0) {
      post(s, { key: `disc:${o.id}`, memo: "تخفیف تأمین‌شده توسط پلتفرم", ref: refs, lines: [[A.EXP_PROMO, o.discount], [A.escrow(o.id), -o.discount]] });
      o.paid.freight += o.discount;
      o.discountPosted = true;
      if (o.couponCode) {
        const c = s.coupons.find((x) => x.code === o.couponCode);
        c?.redemptions.push({ personId: o.shipperId, orderId: o.id, amount: o.discount, at: now(s) });
      }
    }
    if (pay.walletPart > 0) post(s, { key: `pay:${pay.id}:w`, memo: `پرداخت از کیف پول (${purposeLabel(pay.purpose)})`, ref: refs, lines: [[A.shipper(pay.payerId), pay.walletPart], [A.escrow(o.id), -pay.walletPart]] });
    if (pay.cardPart > 0) post(s, { key: `pay:${pay.id}:c`, memo: `پرداخت اینترنتی (${purposeLabel(pay.purpose)})`, ref: refs, lines: [[fromAccount, pay.cardPart], [A.escrow(o.id), -pay.cardPart]] });
    allocate(o, pay.amount);
    advanceAfterPayment(s, o);
  }
  pay.status = "SUCCEEDED";
  s.txKeys[`pay:${pay.id}:done`] = "1";
}

const purposeLabel = (p: PaymentPurpose) => ({ topup: "شارژ", deposit: "بیعانه", balance: "مابقی کرایه", tip: "انعام", mismatch_delta: "مابه‌التفاوت مغایرت", debt: "بدهی", fee: "جریمه" })[p];

/** Deposit satisfied ⇒ details unlock, waybill v1 issued. Balance satisfied after delivery ⇒ settle. */
export function advanceAfterPayment(s: State, o: Order) {
  if (o.status === "AWAITING_DEPOSIT" && shipperPaid(o) >= o.depositRequired) {
    setStatus(s, o, "ASSIGNED", SYSTEM, "بیعانه پرداخت شد");
    o.assignedAt = now(s);
    o.depositDueAt = undefined;
    if (!o.waybills.length) issueWaybill(s, o, "صدور اولیه");
    if (o.driverId) notify(s, o.driverId, "driver", "assigned", `بیعانه پرداخت شد؛ جزئیات سفارش ${o.origin.city} ← ${o.dest.city} باز شد.`, `/driver/trip/?id=${o.id}`);
    notify(s, o.shipperId, "shipper", "assigned", `راننده‌ی سفارش ${o.origin.city} ← ${o.dest.city} قطعی شد.`, `/app/order/?id=${o.id}`);
  }
  if (o.status === "DELIVERED" && !o.settlement && outstanding(o) === 0 && o.cash?.status !== "mismatch") settleOrder(s, o);
}

export type GatewayOutcome = NonNullable<State["demo"]>["gateway"];

export interface PayArgs {
  payerId: string;
  orderId?: string;
  purpose: PaymentPurpose;
  amount: Rial;
  method: PaymentMethod;
  outcome?: GatewayOutcome;
  refNo?: string;
  image?: string;
}

/** Wallet-first checkout. Returns the payment and its status; card flows honour the (demo) gateway scenario. */
export function pay(s: State, a: PayArgs): Result<{ payment: Payment }> {
  const sh = shipperOf(s, a.payerId);
  const isDriverDebt = a.purpose === "debt";
  if (a.amount <= 0) return fail("مبلغ پرداخت معتبر نیست.");
  if (sh?.controls.walletFrozen) return fail("کیف پول شما مسدود است؛ با پشتیبانی مالی تماس بگیرید.");
  if (a.method === "card2card" && sh?.controls.blockCardToCard) return fail("پرداخت کارت‌به‌کارت برای حساب شما فعال نیست.");
  const o = a.orderId ? orderOf(s, a.orderId) : undefined;
  if (a.orderId && !o) return fail("سفارش پیدا نشد.");
  if (o && a.purpose !== "topup" && a.amount > outstanding(o) + 1) return fail("مبلغ بیشتر از مبلغ قابل پرداخت سفارش است.");

  const wallet = isDriverDebt ? 0 : shipperWallet(s, a.payerId).available;
  let walletPart = 0;
  let cardPart = 0;
  let method = a.method;
  if (a.purpose === "topup" || isDriverDebt) {
    cardPart = a.amount;
    if (method === "wallet") return fail("برای شارژ باید روش دیگری انتخاب شود.");
  } else if (method === "wallet") {
    if (wallet < a.amount) return fail("موجودی کیف پول کافی نیست.");
    walletPart = a.amount;
  } else if (method === "split") {
    walletPart = Math.min(wallet, a.amount);
    cardPart = a.amount - walletPart;
    if (cardPart === 0) method = "wallet";
  } else if (method === "credit") {
    if (!sh || sh.controls.creditTermsDays === 0) return fail("اعتبار سازمانی برای شما فعال نیست.");
    const used = bal(s, A.shipperCredit(a.payerId));
    if (used + a.amount > sh.controls.creditLimit) return fail("سقف اعتبار شما برای این پرداخت کافی نیست.");
    const overdue = s.invoices.some((i) => i.partyId === a.payerId && i.status === "OVERDUE");
    if (overdue) return fail("فاکتور سررسیدگذشته دارید؛ ابتدا آن را تسویه کنید.");
  } else {
    cardPart = a.amount;
  }

  const p = newPayment(s, { payerId: a.payerId, orderId: a.orderId, purpose: a.purpose, amount: a.amount, walletPart, cardPart, method });

  // Credit terms: the platform extends credit; shipper's receivable account carries it until the invoice is paid.
  if (method === "credit" && o) {
    post(s, { key: `pay:${p.id}:cr`, memo: "خرید اعتباری (فاکتور پس‌پرداخت)", ref: { paymentId: p.id, orderId: o.id }, lines: [[A.shipperCredit(a.payerId), a.amount], [A.escrow(o.id), -a.amount]] });
    allocate(o, a.amount);
    p.status = "SUCCEEDED";
    s.txKeys[`pay:${p.id}:done`] = "1";
    advanceAfterPayment(s, o);
    return ok({ payment: p });
  }

  if (method === "card2card" || method === "paya") {
    p.status = "AWAITING_VERIFICATION";
    const id = uid(s, "rc");
    s.receipts.unshift({ id, paymentId: p.id, payerId: a.payerId, kind: method === "paya" ? "paya" : "card2card", amount: a.amount, refNo: a.refNo ?? "", image: a.image, at: now(s), slaDueAt: now(s) + 2 * HOUR, status: "PENDING" });
    p.receiptId = id;
    return ok({ payment: p });
  }

  if (method === "wallet") {
    completePayment(s, p);
    return ok({ payment: p });
  }

  // Gateway (card or split).
  const outcome = a.outcome ?? s.demo.gateway;
  p.gatewayRef = `SH-${(s.seq * 7919) % 99999999}`;
  if (outcome === "fail") { p.status = "FAILED"; p.failReason = "پرداخت ناموفق بود (عدم موفقیت تراکنش بانکی)."; return ok({ payment: p }); }
  if (outcome === "cancel") { p.status = "FAILED"; p.failReason = "پرداخت توسط شما لغو شد."; return ok({ payment: p }); }
  if (outcome === "timeout") { p.status = "FAILED"; p.failReason = "مهلت درگاه تمام شد. اگر مبلغ از حساب شما کسر شده، تا ۷۲ ساعت برگشت می‌خورد."; p.deducted = true; return ok({ payment: p }); }
  if (outcome === "delayed") { p.status = "PROCESSING"; p.settleAt = now(s) + settleDelayMs; return ok({ payment: p }); }
  completePayment(s, p);
  if (outcome === "double") completePayment(s, p); // second callback must be a no-op
  return ok({ payment: p });
}

/** Called by the tick: settle delayed gateway callbacks. */
export function settleDelayed(s: State): boolean {
  let changed = false;
  for (const p of s.payments) {
    if (p.status === "PROCESSING" && p.settleAt && p.settleAt <= now(s)) {
      completePayment(s, p);
      changed = true;
      notify(s, p.payerId, p.purpose === "debt" ? "driver" : "shipper", "payment", "پرداخت شما با تأخیر درگاه تأیید شد.", p.orderId ? `/app/order/?id=${p.orderId}` : undefined);
    }
  }
  return changed;
}

/* ───────────────────────── card-to-card receipts ───────────────────────── */

export function verifyReceipt(s: State, receiptId: string, approve: boolean, by: string, reason?: string): Result {
  const r = s.receipts.find((x) => x.id === receiptId);
  if (!r || r.status !== "PENDING") return fail("رسید قابل بررسی نیست.");
  const p = s.payments.find((x) => x.id === r.paymentId);
  if (!p) return fail("پرداخت مرتبط پیدا نشد.");
  r.status = approve ? "APPROVED" : "REJECTED";
  r.reviewedBy = by;
  r.reason = reason;
  if (approve) {
    p.cardPart = p.amount;
    completePayment(s, p);
    notify(s, r.payerId, "shipper", "payment", "رسید کارت‌به‌کارت شما تأیید و مبلغ اعمال شد.", p.orderId ? `/app/order/?id=${p.orderId}` : "/app/wallet/");
  } else {
    p.status = "FAILED";
    p.failReason = reason ?? "رسید تأیید نشد.";
    notify(s, r.payerId, "shipper", "payment", `رسید شما تأیید نشد: ${reason ?? ""}`, "/app/wallet/");
  }
  return ok();
}

/* ───────────────────────── commission, settlement, release ───────────────────────── */

export function commissionRate(s: State, o: Order): number {
  const d = driverOf(s, o.driverId);
  if (d?.controls.commissionOverride !== undefined) return d.controls.commissionOverride;
  if (o.cargoMode === "AMBIENT") return cv<number>(s, "commission.ambient");
  return o.serviceClass === "PRO" ? cv<number>(s, "commission.pro") : cv<number>(s, "commission.standard");
}

export const expectedCommission = (s: State, o: Order) => Math.round((o.freight * commissionRate(s, o)) / 1000) * 1000;

/** Driver's net for a trip (what the driver sees), assuming everything agreed is delivered. */
export function driverNetFor(s: State, o: Order) {
  const comm = expectedCommission(s, o);
  const tipAll = o.tipPre + o.tipPost;
  const tipComm = Math.round((tipAll * cv<number>(s, "commission.tips")) / 1000) * 1000;
  return { commission: comm, tipCommission: tipComm, net: o.freight - comm + tipAll - tipComm, tips: tipAll - tipComm, wait: o.waitFee };
}

/** Escrow → insurer / VAT / platform revenue / driver pending. Commission shortfall becomes driver debt. */
export function settleOrder(s: State, o: Order): void {
  if (o.settlement || !o.driverId) return;
  const dp = o.driverId;
  const rate = commissionRate(s, o);
  const commission = Math.round((o.freight * rate) / 1000) * 1000;
  const tipComm = Math.round((o.paid.tip * cv<number>(s, "commission.tips")) / 1000) * 1000;
  const commTaken = Math.min(commission, o.paid.freight);
  const debt = commission - commTaken;
  const esc = paidTotal(o);
  const driverCredit = o.paid.freight - commTaken + (o.paid.tip - tipComm) + o.paid.waiting;
  post(s, {
    key: `settle:${o.id}`,
    memo: `تسویه‌ی سفارش ${o.origin.city} ← ${o.dest.city}`,
    ref: { orderId: o.id, personId: dp },
    lines: [
      [A.escrow(o.id), esc],
      [A.INS_PAYABLE, -o.paid.insurance],
      [A.VAT_PAYABLE, -o.paid.vat],
      [A.REV_COMM, -(commTaken + tipComm)],
      [A.dPending(dp), -driverCredit],
    ],
  });
  if (debt > 0) {
    post(s, { key: `debt:${o.id}`, memo: "بدهی کارمزد (پرداخت نقدی به راننده)", ref: { orderId: o.id, personId: dp }, lines: [[A.dDebt(dp), debt], [A.REV_COMM, -debt]] });
    s.debts.unshift({ id: uid(s, "dbt"), driverId: dp, orderId: o.id, amount: debt, remaining: debt, at: now(s), reason: "کارمزد پرداخت‌نشده در سفارش نقدی", stage: 0, reminders: 0, status: "OPEN" });
    notify(s, dp, "driver", "debt", "بدهی کارمزد جدیدی برای شما ثبت شد؛ از درآمدهای بعدی کسر می‌شود.", "/driver/wallet/");
  }
  o.settlement = { at: now(s), commission: commTaken + debt, commissionDebt: debt, driverNet: driverCredit - 0, releaseAt: now(s) + cv<number>(s, "settlement.disputeWindowH") * HOUR, released: false, held: false };
  notify(s, dp, "driver", "settled", `درآمد سفر ${o.origin.city} ← ${o.dest.city} در انتظار آزادسازی ثبت شد.`, "/driver/wallet/");
}

export function releaseSettlement(s: State, o: Order): boolean {
  const st = o.settlement;
  if (!st || st.released || st.held || !o.driverId) return false;
  const dp = o.driverId;
  const amount = st.driverNet;
  post(s, { key: `release:${o.id}`, memo: "آزادسازی درآمد پس از پنجره‌ی اعتراض", ref: { orderId: o.id, personId: dp }, lines: [[A.dPending(dp), amount], [A.dAvail(dp), -amount]] });
  st.released = true;
  // Collection ladder step 0: auto-deduct open debt from the first available earnings.
  let room = amount;
  for (const d of s.debts.filter((x) => x.driverId === dp && x.status === "OPEN")) {
    const cut = Math.min(room, d.remaining);
    if (cut <= 0) continue;
    post(s, { key: `autodebt:${d.id}:${o.id}`, memo: "کسر خودکار بدهی کارمزد از درآمد", ref: { orderId: o.id, personId: dp }, lines: [[A.dAvail(dp), cut], [A.dDebt(dp), -cut]] });
    d.remaining -= cut;
    room -= cut;
    if (d.remaining === 0) d.status = "PAID";
  }
  setStatus(s, o, "COMPLETED", SYSTEM, "آزادسازی وجه");
  o.completedAt = now(s);
  notify(s, dp, "driver", "released", `مبلغ سفر ${o.origin.city} ← ${o.dest.city} قابل برداشت شد.`, "/driver/wallet/");
  return true;
}

/* ───────────────────────── cancellation ───────────────────────── */

export interface CancelQuote {
  tier: "free" | "window" | "mid" | "departed" | "not_ready" | "by_driver" | "locked";
  title: string;
  fee: Rial;
  driverComp: Rial;
  platformFee: Rial;
  refund: Rial;
  extra: Rial;
  rows: { label: string; amount: Rial }[];
  allowed: boolean;
}

export function cancelQuote(s: State, o: Order, by: "shipper" | "driver" | "system" | "not_ready"): CancelQuote {
  const paid = shipperPaid(o);
  const base = Math.min(paid, o.depositRequired);
  const zero = (tier: CancelQuote["tier"], title: string, refund: Rial): CancelQuote => ({ tier, title, fee: 0, driverComp: 0, platformFee: 0, refund, extra: 0, rows: [{ label: "بازگشت کامل مبلغ پرداختی", amount: refund }], allowed: true });
  if (by === "driver" || by === "system") return zero("by_driver", "بازگشت کامل به صاحب بار", paid);
  if (["IN_TRANSIT", "AT_DELIVERY", "DELIVERED", "COMPLETED"].includes(o.status) && by === "shipper")
    return { ...zero("locked", "پس از بارگیری لغو ممکن نیست", 0), allowed: false, rows: [{ label: "پس از بارگیری لغو فقط از طریق پشتیبانی ممکن است", amount: 0 }] };
  if (paid === 0 || o.status !== "ASSIGNED" && !o.assignedAt) return zero("free", "لغو رایگان", paid);
  const minutes = (now(s) - (o.assignedAt ?? now(s))) / MIN;
  const departed = !!o.departedAt;
  const deadhead = Math.min(cv<number>(s, "cancel.deadheadCap"), Math.round((o.deadheadKm ?? 0) * cv<number>(s, "cancel.deadheadPerKm")));
  let fee = 0;
  let tier: CancelQuote["tier"] = "mid";
  const rows: CancelQuote["rows"] = [];
  if (by === "not_ready") {
    tier = "not_ready";
    fee = Math.round(base * cv<number>(s, "cancel.departShare")) + deadhead + o.waitFee;
    rows.push({ label: "بیعانه (سهم راننده)", amount: Math.round(base * cv<number>(s, "cancel.departShare")) }, { label: "جبران رفت خالی", amount: deadhead }, { label: "هزینه‌ی انتظار", amount: o.waitFee });
  } else if (!departed && minutes <= cv<number>(s, "cancel.windowMin")) {
    return zero("window", `لغو در ${cv<number>(s, "cancel.windowMin")} دقیقه‌ی اول: بازگشت کامل`, paid);
  } else if (!departed) {
    tier = "mid";
    fee = Math.round(base * cv<number>(s, "cancel.midShare"));
    rows.push({ label: `${Math.round(cv<number>(s, "cancel.midShare") * 100)}٪ بیعانه به راننده می‌رسد`, amount: fee });
  } else {
    tier = "departed";
    const dep = Math.round(base * cv<number>(s, "cancel.departShare"));
    fee = dep + deadhead;
    rows.push({ label: "بیعانه (راننده حرکت کرده است)", amount: dep }, { label: "جبران رفت خالی راننده", amount: deadhead });
  }
  const platformFee = Math.round((fee * cv<number>(s, "cancel.platformCut")) / 1000) * 1000;
  const refund = Math.max(0, paid - fee);
  const extra = Math.max(0, fee - paid);
  rows.push({ label: "بازگشت به شما", amount: refund });
  const title = tier === "mid" ? "لغو پس از مهلت بازگشت کامل" : tier === "departed" ? "لغو پس از حرکت راننده" : "صاحب بار آماده نبود";
  return { tier, title, fee, driverComp: fee - platformFee, platformFee, refund, extra, rows, allowed: true };
}

/** Executes the money side of a cancellation. The order's own status change is the caller's job. */
export function cancelPostings(s: State, o: Order, q: CancelQuote, refundTo: "wallet" | "card" = "wallet") {
  const sp = o.shipperId;
  const escBal = bal(s, A.escrow(o.id));
  const promo = o.discountPosted ? Math.min(o.discount, escBal) : 0;
  const own = Math.max(0, escBal - promo); // the shipper's own money in escrow
  const toDriver = Math.min(q.driverComp, own);
  const toPlatform = Math.min(q.platformFee, own - toDriver);
  const back = own - toDriver - toPlatform;
  if (escBal > 0) {
    const lines: [string, Rial][] = [[A.escrow(o.id), escBal]];
    if (o.driverId && toDriver > 0) lines.push([A.dPending(o.driverId), -toDriver]);
    if (toPlatform > 0) lines.push([A.REV_FEES, -toPlatform]);
    if (promo > 0) lines.push([A.EXP_PROMO, -promo]);
    if (back > 0) lines.push([refundTo === "card" ? A.GATEWAY : A.shipper(sp), -back]);
    post(s, { key: `cancel:${o.id}:${s.seq}`, memo: "تسویه‌ی لغو سفارش", ref: { orderId: o.id, personId: sp }, lines });
    if (back > 0) {
      s.refunds.unshift({ id: uid(s, "rf"), at: now(s), payerId: sp, orderId: o.id, amount: back, to: refundTo, status: "PAID", reason: "بازگشت وجه پس از لغو سفارش", eta: refundTo === "card" ? now(s) + 3 * DAY : undefined });
    }
  }
  // Fee beyond what was held is taken from the wallet when possible, otherwise recorded as arrears.
  const shortfall = Math.max(0, q.fee - toDriver - toPlatform);
  if (shortfall > 0) {
    const w = shipperWallet(s, sp).available;
    const fromW = Math.min(w, shortfall);
    const ar = shortfall - fromW;
    const dShare = Math.round(shortfall * (q.driverComp / Math.max(1, q.fee)));
    const pShare = shortfall - dShare;
    const lines: [string, Rial][] = [];
    if (fromW > 0) lines.push([A.shipper(sp), fromW]);
    if (ar > 0) lines.push([A.shipperAr(sp), ar]);
    if (o.driverId && dShare > 0) lines.push([A.dPending(o.driverId), -dShare]);
    if (pShare > 0) lines.push([A.REV_FEES, -pShare]);
    post(s, { key: `cancelx:${o.id}:${s.seq}`, memo: "جریمه‌ی لغو (مازاد بر بیعانه)", ref: { orderId: o.id, personId: sp }, lines });
    if (ar > 0) notify(s, sp, "shipper", "arrears", "بخشی از جریمه‌ی لغو به‌صورت بدهی ثبت شد؛ پیش از سفارش بعدی تسویه کنید.", "/app/wallet/");
  }
  o.paid = { insurance: 0, vat: 0, tip: 0, freight: 0, waiting: 0 };
  void audit;
  void actorPerson;
  void person;
}

/** Shipper settles unpaid arrears (waiting fees, shortfalls) from the wallet or by card. */
export function payArrears(s: State, shipperId: string, method: "wallet" | "card"): Result<{ amount: Rial }> {
  const due = bal(s, A.shipperAr(shipperId));
  if (due <= 0) return fail("بدهی بازی ندارید.");
  if (method === "wallet") {
    if (shipperWallet(s, shipperId).available < due) return fail("موجودی کیف پول کافی نیست.");
    post(s, { key: `arr:${shipperId}:${s.seq}`, memo: "تسویه‌ی بدهی از کیف پول", ref: { personId: shipperId }, lines: [[A.shipper(shipperId), due], [A.shipperAr(shipperId), -due]] });
  } else {
    if (["fail", "cancel", "timeout"].includes(s.demo.gateway)) return fail("پرداخت ناموفق بود. دوباره تلاش کنید.");
    post(s, { key: `arr:${shipperId}:${s.seq}`, memo: "تسویه‌ی بدهی (درگاه)", ref: { personId: shipperId }, lines: [[A.GATEWAY, due], [A.shipperAr(shipperId), -due]] });
  }
  s.seq++;
  return ok({ amount: due });
}
