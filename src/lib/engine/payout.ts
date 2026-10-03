import { A, bal, driverWallet, post } from "../ledger";
import type { Approval, Coupon, Debt, Incentive, Invoice, InvoiceKind, Payout, PayoutBatch, PayoutStatus, Refund, Rial, State } from "../types";
import { actorPerson, audit, cv, DAY, driverOf, fail, HOUR, notify, now, ok, person, shipperOf, uid, type Actor, type Result } from "./core";
import { applyDebtPayment, pay, type GatewayOutcome } from "./pay";

const MINS = 60_000;

/* ───────────────────────── driver payouts ───────────────────────── */

const todayStart = (s: State) => new Date(now(s)).setHours(0, 0, 0, 0);
const hist = (p: Payout, s: State, status: PayoutStatus, by: string, note?: string) => {
  p.status = status;
  p.history.push({ at: now(s), status, by, note });
};

export function setIban(s: State, driverId: string, sheba: string): Result {
  const d = driverOf(s, driverId);
  const pr = person(s, driverId);
  if (!d || !pr) return fail("حساب راننده پیدا نشد.");
  const clean = sheba.replace(/\s/g, "").toUpperCase();
  if (!/^IR\d{24}$/.test(clean)) return fail("شماره‌ی شبا باید با IR شروع شود و ۲۴ رقم داشته باشد.");
  // Mock bank lookup: holder name comes back from the bank; the last digit decides the demo outcome.
  const matches = Number(clean.slice(-1)) % 5 !== 0;
  d.iban = { sheba: clean, holder: matches ? pr.name : "مریم کاظمی‌نژاد", holderMatches: matches, addedAt: now(s) };
  if (!matches) {
    s.risk.unshift({ id: uid(s, "rk"), at: now(s), kind: "عدم تطابق نام صاحب شبا", personId: driverId, severity: "medium", detail: `نام بانکی با هویت احرازشده یکی نیست: ${d.iban.holder}`, status: "OPEN" });
    return fail("نام صاحب حساب با هویت احرازشده‌ی شما یکی نیست؛ شبای متعلق به خودتان را وارد کنید.");
  }
  return ok();
}

export function requestPayout(s: State, driverId: string, amount: Rial, instant: boolean): Result<{ id: string }> {
  const d = driverOf(s, driverId);
  if (!d) return fail("حساب راننده پیدا نشد.");
  const w = driverWallet(s, driverId);
  if (d.controls.walletFrozen) return fail("کیف پول شما مسدود است؛ با پشتیبانی مالی تماس بگیرید.");
  if (d.controls.payoutHold) return fail("برداشت شما موقتاً در انتظار بررسی است.");
  if (!d.iban?.holderMatches) return fail("ابتدا شماره‌ی شبای معتبر ثبت کنید.");
  if (amount < cv<number>(s, "payout.min")) return fail(`حداقل برداشت ${cv<number>(s, "payout.min") / 10} تومان است.`);
  if (amount > cv<number>(s, "payout.max")) return fail("مبلغ بیشتر از سقف هر درخواست است.");
  if (amount > w.available) return fail("موجودی قابل برداشت کافی نیست.");
  const today = s.payouts.filter((p) => p.driverId === driverId && p.at >= todayStart(s) && p.status !== "FAILED").reduce((n, p) => n + p.amount, 0);
  if (today + amount > cv<number>(s, "payout.dailyLimit")) return fail("سقف برداشت روزانه‌ی شما پر شده است.");
  if (instant && !d.controls.instantPayout) return fail("برداشت فوری برای حساب شما فعال نیست.");
  const fee = instant ? Math.round((amount * cv<number>(s, "payout.instantFeePct")) / 1000) * 1000 : 0;
  const flags: string[] = [];
  if (!s.payouts.some((p) => p.driverId === driverId && p.status === "SETTLED") && cv<boolean>(s, "payout.firstHold")) flags.push("اولین برداشت");
  if (now(s) - d.iban.addedAt < 72 * HOUR) flags.push("شبای جدید");
  if (amount >= cv<number>(s, "payout.fourEyes")) flags.push("مبلغ بالا (تأیید دو نفره)");
  const p: Payout = { id: uid(s, "po"), driverId, amount, fee, instant, status: "REQUESTED", sheba: d.iban.sheba, holder: d.iban.holder, at: now(s), flags, history: [{ at: now(s), status: "REQUESTED", by: "راننده" }] };
  post(s, { key: `po:${p.id}:req`, memo: `درخواست برداشت ${instant ? "فوری " : ""}`, ref: { payoutId: p.id, personId: driverId }, lines: [[A.dAvail(driverId), amount], [A.dHold(driverId), -amount]] });
  hist(p, s, flags.length ? "UNDER_REVIEW" : "APPROVED", "سیستم", flags.length ? `بررسی دستی: ${flags.join("، ")}` : "تأیید خودکار");
  s.payouts.unshift(p);
  notify(s, driverId, "driver", "payout", flags.length ? "درخواست برداشت ثبت شد و در صف بررسی است." : "درخواست برداشت ثبت و تأیید شد.", "/driver/wallet/");
  return ok({ id: p.id });
}

export function payoutAction(s: State, actor: Actor, id: string, action: "approve" | "hold" | "release" | "send" | "settle" | "fail", note = ""): Result {
  const p = s.payouts.find((x) => x.id === id);
  if (!p) return fail("برداشت پیدا نشد.");
  const from = p.status;
  const need = (...st: PayoutStatus[]) => st.includes(from);
  switch (action) {
    case "approve": if (!need("UNDER_REVIEW", "REQUESTED")) return fail("وضعیت برداشت اجازه نمی‌دهد."); hist(p, s, "APPROVED", actor.label, note); break;
    case "hold": if (!need("UNDER_REVIEW", "REQUESTED", "APPROVED")) return fail("وضعیت برداشت اجازه نمی‌دهد."); hist(p, s, "ON_HOLD", actor.label, note); break;
    case "release": if (!need("ON_HOLD")) return fail("وضعیت برداشت اجازه نمی‌دهد."); hist(p, s, "UNDER_REVIEW", actor.label, note); break;
    case "send": if (!need("APPROVED")) return fail("فقط برداشت تأییدشده ارسال می‌شود."); hist(p, s, "SENT", actor.label, note); break;
    case "settle":
      if (!need("SENT")) return fail("فقط برداشت ارسال‌شده تسویه می‌شود.");
      post(s, { key: `po:${p.id}:set`, memo: "واریز برداشت به حساب بانکی راننده", ref: { payoutId: p.id, personId: p.driverId }, lines: [[A.dHold(p.driverId), p.amount], [A.BANK, -(p.amount - p.fee)], ...(p.fee ? ([[A.REV_FEES, -p.fee]] as [string, Rial][]) : [])] });
      hist(p, s, "SETTLED", actor.label, note);
      notify(s, p.driverId, "driver", "payout", `مبلغ ${(p.amount - p.fee) / 10} تومان به حساب شما واریز شد.`, "/driver/wallet/");
      break;
    case "fail":
      if (!need("SENT", "APPROVED", "UNDER_REVIEW", "REQUESTED")) return fail("وضعیت برداشت اجازه نمی‌دهد.");
      post(s, { key: `po:${p.id}:fail`, memo: "بازگشت برداشت ناموفق به کیف پول", ref: { payoutId: p.id, personId: p.driverId }, lines: [[A.dHold(p.driverId), p.amount], [A.dAvail(p.driverId), -p.amount]] });
      p.failReason = note || "رد توسط بانک";
      hist(p, s, "FAILED", actor.label, p.failReason);
      notify(s, p.driverId, "driver", "payout", `برداشت ناموفق بود (${p.failReason}) و مبلغ به کیف پول برگشت.`, "/driver/wallet/");
      break;
  }
  audit(s, actor, `payout.${action}`, note || p.id, p.id);
  return ok();
}

export function createBatch(s: State, actor: Actor, ids: string[]): Result<{ id: string }> {
  const list = s.payouts.filter((p) => ids.includes(p.id) && p.status === "APPROVED" && !p.batchId);
  if (!list.length) return fail("برداشت تأییدشده‌ای برای دسته انتخاب نشده است.");
  const b: PayoutBatch = { id: uid(s, "pb"), at: now(s), status: "DRAFT", payoutIds: list.map((p) => p.id), createdBy: actor.label };
  for (const p of list) p.batchId = b.id;
  s.batches.unshift(b);
  audit(s, actor, "batch.create", `${list.length} مورد`, b.id);
  return ok({ id: b.id });
}

export function batchAction(s: State, actor: Actor, id: string, action: "approve" | "export" | "send" | "reconcile", failedIds: string[] = []): Result {
  const b = s.batches.find((x) => x.id === id);
  if (!b) return fail("دسته پیدا نشد.");
  if (action === "approve" && b.status === "DRAFT") { b.status = "APPROVED"; b.approvedBy = actor.label; }
  else if (action === "export" && b.status === "APPROVED") b.status = "EXPORTED";
  else if (action === "send" && b.status === "EXPORTED") { b.status = "SENT"; for (const pid of b.payoutIds) payoutAction(s, actor, pid, "send", "ارسال دسته‌ای"); }
  else if (action === "reconcile" && b.status === "SENT") {
    for (const pid of b.payoutIds) {
      if (failedIds.includes(pid)) payoutAction(s, actor, pid, "fail", "رد در فایل نتیجه‌ی بانک");
      else payoutAction(s, actor, pid, "settle", "واریز در فایل نتیجه‌ی بانک");
    }
    b.status = "RECONCILED";
  } else return fail("وضعیت دسته اجازه‌ی این اقدام را نمی‌دهد.");
  audit(s, actor, `batch.${action}`, b.id, b.id);
  return ok();
}

/* ───────────────────────── debts ───────────────────────── */

export function payDebt(s: State, driverId: string, amount: Rial, method: "card" | "wallet", outcome?: GatewayOutcome): Result<{ status: string }> {
  const open = s.debts.filter((d) => d.driverId === driverId && d.status === "OPEN").reduce((n, d) => n + d.remaining, 0);
  if (open <= 0) return fail("بدهی بازی ندارید.");
  const amt = Math.min(amount, open);
  if (method === "wallet") {
    if (driverWallet(s, driverId).available < amt) return fail("موجودی قابل برداشت کافی نیست.");
    post(s, { key: `debtw:${driverId}:${s.seq}`, memo: "تسویه‌ی بدهی از کیف پول", ref: { personId: driverId }, lines: [[A.dAvail(driverId), amt], [A.dDebt(driverId), -amt]] });
    applyDebtPayment(s, driverId, amt);
    return ok({ status: "SUCCEEDED" });
  }
  const r = pay(s, { payerId: driverId, purpose: "debt", amount: amt, method: "card", outcome });
  if (!r.ok) return r;
  if (r.payment.status === "FAILED") return fail(r.payment.failReason ?? "پرداخت ناموفق بود.");
  return ok({ status: r.payment.status });
}

export function requestWriteOff(s: State, actor: Actor, debtId: string): Result {
  const d = s.debts.find((x) => x.id === debtId);
  if (!d || d.status !== "OPEN") return fail("بدهی قابل حذف نیست.");
  d.status = "PENDING_WRITEOFF";
  d.stage = 5;
  const ap: Approval = { id: uid(s, "ap"), at: now(s), action: "debt.writeoff", title: `سوخت‌کردن بدهی ${d.remaining / 10} تومانی راننده`, requestedBy: actor.label, amount: d.remaining, payload: { debtId }, status: "PENDING", needs: ["finance_mgr", "super"] };
  s.approvals.unshift(ap);
  audit(s, actor, "debt.writeoff.request", d.id, d.id);
  return ok();
}

export function executeWriteOff(s: State, actor: Actor, debtId: string): Result {
  const d = s.debts.find((x) => x.id === debtId);
  if (!d || d.status !== "PENDING_WRITEOFF") return fail("بدهی در انتظار حذف نیست.");
  post(s, { key: `wo:${d.id}`, memo: "سوخت‌کردن بدهی کارمزد", ref: { personId: d.driverId }, lines: [[A.BAD_DEBT, d.remaining], [A.dDebt(d.driverId), -d.remaining]] });
  d.remaining = 0;
  d.status = "WRITTEN_OFF";
  audit(s, actor, "debt.writeoff", d.id, d.id);
  return ok();
}

export function debtOpen(s: State, driverId: string): Debt[] {
  return s.debts.filter((d) => d.driverId === driverId && d.status === "OPEN");
}

/* ───────────────────────── refunds ───────────────────────── */

export function createRefund(s: State, actor: Actor, a: { payerId: string; orderId?: string; ticketId?: string; amount: Rial; to: "wallet" | "card"; reason: string }, ceiling: Rial): Result<{ id: string; pending: boolean }> {
  const sh = shipperOf(s, a.payerId);
  if (sh?.controls.refundLimit !== undefined && a.amount > sh.controls.refundLimit) return fail("مبلغ بیشتر از سقف بازپرداخت این صاحب بار است.");
  const r: Refund = { id: uid(s, "rf"), at: now(s), payerId: a.payerId, orderId: a.orderId, ticketId: a.ticketId, amount: a.amount, to: a.to, status: "PENDING_APPROVAL", reason: a.reason };
  s.refunds.unshift(r);
  if (a.amount <= ceiling) { payRefund(s, actor, r); return ok({ id: r.id, pending: false }); }
  s.approvals.unshift({ id: uid(s, "ap"), at: now(s), action: "refund", title: `بازپرداخت ${a.amount / 10} تومان`, requestedBy: actor.label, amount: a.amount, payload: { refundId: r.id }, status: "PENDING", needs: ["finance_mgr", "super"] });
  return ok({ id: r.id, pending: true });
}

export function payRefund(s: State, actor: Actor, r: Refund) {
  post(s, { key: `refund:${r.id}`, memo: `بازپرداخت: ${r.reason}`, ref: { personId: r.payerId, orderId: r.orderId, ticketId: r.ticketId }, lines: [[A.EXP_REFUND, r.amount], [r.to === "card" ? A.GATEWAY : A.shipper(r.payerId), -r.amount]] });
  r.status = "PAID";
  r.decidedBy = actor.label;
  if (r.to === "card") r.eta = now(s) + 3 * DAY;
  notify(s, r.payerId, "shipper", "refund", r.to === "card" ? "بازپرداخت به کارت شما ثبت شد (تا ۳ روز کاری)." : "بازپرداخت به کیف پول شما واریز شد.", "/app/wallet/");
  audit(s, actor, "refund.pay", `${r.amount / 10} تومان · ${r.reason}`, r.id);
}

/* ───────────────────────── coupons ───────────────────────── */

export function upsertCoupon(s: State, actor: Actor, c: Omit<Coupon, "redemptions"> & { redemptions?: Coupon["redemptions"] }) {
  const code = c.code.trim().toUpperCase();
  const cur = s.coupons.find((x) => x.code === code);
  if (cur) Object.assign(cur, c, { code, redemptions: cur.redemptions });
  else s.coupons.unshift({ ...c, code, redemptions: [] });
  audit(s, actor, "coupon.upsert", code, code);
}

export function bulkCoupons(s: State, actor: Actor, prefix: string, n: number, base: Omit<Coupon, "code" | "redemptions">) {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const code = `${prefix.toUpperCase()}-${(1000 + ((s.seq + i * 7919) % 9000)).toString()}`;
    s.coupons.unshift({ ...base, code, redemptions: [] });
    out.push(code);
  }
  audit(s, actor, "coupon.bulk", `${n} کد با پیشوند ${prefix}`, prefix);
  return out;
}

/* ───────────────────────── incentives ───────────────────────── */

const weekKey = (t: number) => Math.floor(t / (7 * DAY));

export function incentiveProgress(s: State, driverId: string, inc: Incentive): { value: number; target: number; done: boolean; awarded: boolean } {
  const t = now(s);
  const week = s.orders.filter((o) => o.driverId === driverId && ["DELIVERED", "COMPLETED"].includes(o.status) && (o.deliveredAt ?? 0) >= t - 7 * DAY);
  let value = 0;
  if (inc.kind === "trip_count") value = week.length;
  else if (inc.kind === "peak_route") value = week.filter((o) => `${o.origin.city}>${o.dest.city}` === inc.route || `${o.dest.city}>${o.origin.city}` === inc.route).length;
  else if (inc.kind === "backhaul") value = week.filter((o) => o.cargoMode === "AMBIENT").length;
  else if (inc.kind === "streak") {
    const days = new Set(week.map((o) => Math.floor((o.deliveredAt ?? 0) / DAY)));
    value = days.size;
  } else if (inc.kind === "pro") value = driverOf(s, driverId)?.pro.status === "pro" ? week.length : 0;
  else value = s.referrals.filter((r) => r.referrerId === driverId && r.status !== "PENDING").length;
  const awarded = !!s.txKeys[`inc:${inc.id}:${driverId}:${weekKey(t)}`];
  return { value, target: inc.target, done: value >= inc.target, awarded };
}

export function claimIncentive(s: State, driverId: string, incId: string): Result<{ reward: Rial }> {
  const inc = s.incentives.find((x) => x.id === incId);
  const d = driverOf(s, driverId);
  if (!inc || !inc.active || !d) return fail("این مشوق فعال نیست.");
  if (!d.controls.incentiveEligible) return fail("حساب شما مشمول مشوق‌ها نیست.");
  const pr = incentiveProgress(s, driverId, inc);
  if (!pr.done) return fail("هنوز به هدف نرسیده‌اید.");
  if (pr.awarded) return fail("پاداش این هفته را قبلاً گرفته‌اید.");
  if (inc.spent + inc.reward > inc.budget) return fail("بودجه‌ی این مشوق تمام شده است.");
  post(s, { key: `inc:${inc.id}:${driverId}:${weekKey(now(s))}`, memo: `پاداش مشوق: ${inc.title}`, ref: { personId: driverId }, lines: [[A.EXP_PROMO, inc.reward], [A.dAvail(driverId), -inc.reward]] });
  inc.spent += inc.reward;
  notify(s, driverId, "driver", "bonus", `پاداش «${inc.title}» به کیف پول شما واریز شد.`, "/driver/wallet/");
  return ok({ reward: inc.reward });
}

/* ───────────────────────── invoices ───────────────────────── */

const PREFIX: Record<InvoiceKind, string> = { receipt: "RC", tax_invoice: "TI", credit_note: "CN", driver_statement: "DS", monthly_statement: "MS", insurer_settlement: "IS" };

export function issueInvoice(s: State, kind: InvoiceKind, partyId: string, amount: Rial, lines: Invoice["lines"], extra: Partial<Invoice> = {}): Invoice {
  const n = s.invoices.filter((i) => i.kind === kind).length + 1;
  const inv: Invoice = { id: uid(s, "inv"), no: `${PREFIX[kind]}-${new Intl.NumberFormat("en-US", { useGrouping: false, minimumIntegerDigits: 6 }).format(n)}`, kind, partyId, amount, vat: 0, at: now(s), status: "ISSUED", lines, dunning: [], ...extra };
  s.invoices.unshift(inv);
  return inv;
}

export function voidInvoice(s: State, actor: Actor, id: string, reason: string): Result {
  const i = s.invoices.find((x) => x.id === id);
  if (!i || i.status === "VOID") return fail("فاکتور قابل ابطال نیست.");
  i.status = "VOID";
  audit(s, actor, "invoice.void", `${i.no}: ${reason}`, i.id);
  const cn = issueInvoice(s, "credit_note", i.partyId, i.amount, [{ label: `ابطال ${i.no}: ${reason}`, amount: i.amount }], { orderId: i.orderId });
  return ok({ credit: cn.no } as object);
}

export function payInvoice(s: State, shipperId: string, invoiceId: string, method: "wallet" | "card", outcome?: GatewayOutcome): Result {
  const inv = s.invoices.find((x) => x.id === invoiceId && x.partyId === shipperId);
  if (!inv || !["ISSUED", "OVERDUE"].includes(inv.status)) return fail("فاکتور قابل پرداخت نیست.");
  if (method === "wallet") {
    const w = bal(s, A.shipper(shipperId));
    if (w < inv.amount) return fail("موجودی کیف پول کافی نیست.");
    post(s, { key: `invp:${inv.id}`, memo: `تسویه‌ی فاکتور ${inv.no}`, ref: { personId: shipperId }, lines: [[A.shipper(shipperId), inv.amount], [A.shipperCredit(shipperId), -inv.amount]] });
  } else {
    const gw = outcome ?? s.demo.gateway;
    if (gw === "fail" || gw === "cancel" || gw === "timeout") return fail("پرداخت ناموفق بود. دوباره تلاش کنید.");
    post(s, { key: `invp:${inv.id}`, memo: `تسویه‌ی فاکتور ${inv.no} (درگاه)`, ref: { personId: shipperId }, lines: [[A.GATEWAY, inv.amount], [A.shipperCredit(shipperId), -inv.amount]] });
  }
  inv.status = "PAID";
  return ok();
}

export function markOverdue(s: State): boolean {
  let c = false;
  for (const i of s.invoices) if (i.status === "ISSUED" && i.dueAt && i.dueAt < now(s) && i.kind === "tax_invoice") { i.status = "OVERDUE"; c = true; }
  return c;
}

void MINS;
void actorPerson;
