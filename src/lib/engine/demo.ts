import { rng } from "../rng";
import { buildInput } from "../seed/history";
import { A, post } from "../ledger";
import type { Order, State } from "../types";
import { audit, fail, HOUR, MIN, now, ok, SYSTEM, uid, type Result } from "./core";
import { createOrders, engineTick } from "./orders";
import { releaseSettlement, verifyReceipt } from "./pay";
import { batchAction, createBatch, payoutAction } from "./payout";
import { dailyClose } from "./finance";
import { replyTicket } from "./trust";

/**
 * Demo Director actions: they only drive the same engine the product uses (no shortcuts around the ledger), so what the demo shows is real behaviour.
 * Each returns a short Persian line describing what happened.
 */
export function spawnDemoOrder(s: State, kind: "open" | "pro" | "direct"): Result<{ msg: string }> {
  const sh = s.shippers.find((x) => !x.controls.blocked) ?? s.shippers[0];
  const sim = { s, r: rng(s.seq * 31 + 7), t: now(s), errors: [] as string[] };
  const pro = s.drivers.find((d) => d.pro.status === "pro");
  const ov = kind === "pro" ? { serviceClass: "PRO" as const, assignMode: "PRO_POOL" as const, vehicleKind: "truck10" as const } : kind === "direct" && pro ? { serviceClass: "PRO" as const, assignMode: "DIRECT" as const, directDriverId: pro.personId, vehicleKind: pro.vehicle.kind } : {};
  const input = buildInput(sim, sh.personId, kind === "direct" && pro ? pro.personId : null, { ...ov, couponCode: undefined });
  const shift = Math.max(0, now(s) + 2 * HOUR - input.pickupAt);
  input.pickupAt += shift; input.pickupTo += shift; input.deliverBy += shift;
  const r = createOrders(s, sh.personId, input);
  if (!r.ok) return r;
  return ok({ msg: `سفارش ${input.origin.city} ← ${input.dest.city} ثبت شد.` });
}

const byStatus = (s: State, st: Order["status"]) => s.orders.filter((o) => o.status === st);

/** Makes the deposit deadline of every waiting order pass, then lets the engine react (freeze release, auto-cancel + warnings). */
export function expireDeposits(s: State): Result<{ msg: string }> {
  const list = byStatus(s, "AWAITING_DEPOSIT");
  if (!list.length) return fail("سفارشی در انتظار بیعانه نیست. ابتدا از پنل راننده یک بار را تأیید کنید.");
  for (const o of list) o.depositDueAt = now(s) - MIN;
  engineTick(s);
  return ok({ msg: `مهلت بیعانه‌ی ${list.length} سفارش تمام شد.` });
}

/** Pretend the dispute window has passed so driver earnings become withdrawable. */
export function advanceDisputeWindow(s: State): Result<{ msg: string }> {
  let n = 0;
  for (const o of s.orders) if (o.settlement && !o.settlement.released && !o.settlement.held) { o.settlement.releaseAt = now(s) - MIN; if (releaseSettlement(s, o)) n++; }
  return n ? ok({ msg: `درآمد ${n} سفر قابل برداشت شد.` }) : fail("سفر در پنجره‌ی اعتراض نیست.");
}

export function approveAllReceipts(s: State, by: string): Result<{ msg: string }> {
  const list = s.receipts.filter((r) => r.status === "PENDING");
  if (!list.length) return fail("رسید در انتظاری نیست.");
  for (const r of list) verifyReceipt(s, r.id, true, by);
  return ok({ msg: `${list.length} رسید تأیید شد.` });
}

/** Approve every waiting payout, batch it, send it and settle it (all successful), the full finance happy path. */
export function runPayoutBatch(s: State, adminLabel: string, failFirst = false): Result<{ msg: string }> {
  const actor = { ...SYSTEM, label: adminLabel };
  const waiting = s.payouts.filter((p) => ["REQUESTED", "UNDER_REVIEW"].includes(p.status));
  for (const p of waiting) payoutAction(s, actor, p.id, "approve", "Demo Director");
  const b = createBatch(s, actor, s.payouts.filter((p) => p.status === "APPROVED" && !p.batchId).map((p) => p.id));
  if (!b.ok) return b;
  batchAction(s, actor, b.id, "approve"); batchAction(s, actor, b.id, "export"); batchAction(s, actor, b.id, "send");
  const batch = s.batches.find((x) => x.id === b.id)!;
  batchAction(s, actor, b.id, "reconcile", failFirst ? batch.payoutIds.slice(0, 1) : []);
  return ok({ msg: `دسته‌ی ${batch.payoutIds.length} برداشتی ${failFirst ? "با یک ردی" : ""} تسویه شد.` });
}

export function failFirstPayout(s: State): Result<{ msg: string }> {
  const p = s.payouts.find((x) => ["SENT", "APPROVED", "UNDER_REVIEW", "REQUESTED"].includes(x.status));
  if (!p) return fail("برداشت فعالی نیست.");
  const r = payoutAction(s, { ...SYSTEM, label: "Demo Director" }, p.id, "fail", "رد توسط بانک (شبیه‌سازی)");
  return r.ok ? ok({ msg: "برداشت ناموفق شد و مبلغ به کیف پول راننده برگشت." }) : r;
}

export function userSupportMessage(s: State): Result<{ msg: string }> {
  const t = s.tickets.find((x) => !["CLOSED"].includes(x.status));
  if (!t) return fail("تیکتی وجود ندارد.");
  replyTicket(s, t.id, "user", "سلام، هنوز مشکل حل نشده؛ لطفاً سریع‌تر پیگیری کنید.");
  return ok({ msg: `پیام جدید از «${t.subject}» رسید.` });
}

/** A cash-on-delivery shortfall: books a debt-like unmatched amount into SUSPENSE so reconciliation has something to chase. */
export function dropSuspense(s: State): Result<{ msg: string }> {
  post(s, { key: `demo:susp:${uid(s, "d")}`, memo: "واریز ناشناس بانکی (شبیه‌سازی)", lines: [[A.BANK, 30_000_000], [A.SUSPENSE, -30_000_000]] });
  return ok({ msg: "یک واریز ناشناس ۳ میلیون تومانی در حساب معلق نشست." });
}

export function closeToday(s: State, label: string): Result<{ msg: string }> {
  const day = new Date(now(s)).setHours(0, 0, 0, 0);
  const r = dailyClose(s, { ...SYSTEM, label }, day);
  if (!r.ok) return r;
  audit(s, { ...SYSTEM, label }, "demo.close", "Demo Director");
  return ok({ msg: "روز مالی امروز بسته شد." });
}
