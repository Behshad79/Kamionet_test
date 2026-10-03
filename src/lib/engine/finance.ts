import { A, bal, post, trialBalance } from "../ledger";
import type { Claim, Rial, ReconFile, ReconRow, State } from "../types";
import { audit, DAY, fail, notify, now, ok, orderOf, uid, type Actor, type Result } from "./core";

/* ───────────────────────── reconciliation ───────────────────────── */

/** Generates a settlement file from what the system itself recorded, then perturbs a few rows so the match step has real work. */
export function buildReconFile(s: State, kind: "gateway" | "bank", from: number, to: number, withNoise = true): ReconFile {
  const pays = s.payments.filter((p) => p.status === "SUCCEEDED" && p.at >= from && p.at < to && (kind === "gateway" ? p.trail?.channel === "gateway" : ["card2card", "paya"].includes(p.trail?.channel ?? "")));
  const rows: ReconRow[] = pays.map((p) => ({ ref: (kind === "gateway" ? p.trail?.rrn : p.receiptId ?? p.id) ?? p.id, amount: p.cardPart || p.amount, matched: false }));
  if (withNoise && rows.length > 6) {
    rows[1].amount += 10_000; // amount differs
    rows.splice(3, 1); // missing at the processor
    rows.push({ ref: `X${String(s.seq).padStart(9, "7")}`, amount: 45_000_000, matched: false, note: "تراکنش ناشناس" }); // not ours
  }
  return { id: uid(s, "rc"), kind, at: now(s), name: `${kind === "gateway" ? "تسویه‌ی درگاه" : "صورت‌حساب بانک"} ${new Date(from).toISOString().slice(0, 10)}`, rows };
}

export function matchRecon(s: State, fileId: string): { matched: number; unmatched: number } {
  const f = s.recon.find((x) => x.id === fileId);
  if (!f) return { matched: 0, unmatched: 0 };
  for (const r of f.rows) {
    const p = s.payments.find((x) => x.status === "SUCCEEDED" && (x.trail?.rrn === r.ref || x.receiptId === r.ref || x.id === r.ref));
    if (p && (p.cardPart || p.amount) === r.amount) { r.matched = true; r.paymentId = p.id; r.note = undefined; }
    else r.note = p ? `اختلاف مبلغ: سیستم ${(p.cardPart || p.amount) / 10} تومان` : r.note ?? "در سیستم یافت نشد";
  }
  const m = f.rows.filter((r) => r.matched).length;
  return { matched: m, unmatched: f.rows.length - m };
}

/** Park an unmatched amount in SUSPENSE (never silently absorbed), to be attributed later. */
export function parkInSuspense(s: State, actor: Actor, fileId: string, ref: string): Result {
  const f = s.recon.find((x) => x.id === fileId);
  const r = f?.rows.find((x) => x.ref === ref);
  if (!f || !r || r.matched) return fail("ردیف قابل انتقال نیست.");
  post(s, { key: `susp:${fileId}:${ref}`, memo: `انتقال به حساب معلق: ${ref}`, lines: [[f.kind === "gateway" ? A.GATEWAY : A.BANK, r.amount], [A.SUSPENSE, -r.amount]] });
  r.matched = true;
  r.note = "در حساب معلق";
  audit(s, actor, "recon.suspense", `${ref} · ${r.amount / 10} تومان`, fileId);
  return ok();
}

export function attributeSuspense(s: State, actor: Actor, fileId: string, ref: string, shipperId: string): Result {
  const f = s.recon.find((x) => x.id === fileId);
  const r = f?.rows.find((x) => x.ref === ref);
  if (!r || r.note !== "در حساب معلق") return fail("این ردیف در حساب معلق نیست.");
  post(s, { key: `suspa:${fileId}:${ref}`, memo: `انتساب وجه معلق به کیف پول`, ref: { personId: shipperId }, lines: [[A.SUSPENSE, r.amount], [A.shipper(shipperId), -r.amount]] });
  r.note = "منتسب شد";
  notify(s, shipperId, "shipper", "payment", "وجه واریزی شما شناسایی و به کیف پول افزوده شد.", "/app/wallet/");
  audit(s, actor, "recon.attribute", `${ref} → ${shipperId}`, fileId);
  return ok();
}

/* ───────────────────────── daily close + period lock ───────────────────────── */

export function dailyClose(s: State, actor: Actor, day: number): Result {
  if (s.closes.some((c) => c.day === day)) return fail("این روز قبلاً بسته شده است.");
  const tb = trialBalance(s);
  const debit = tb.reduce((n, r) => n + r.debit, 0);
  const credit = tb.reduce((n, r) => n + r.credit, 0);
  const unmatched = s.recon.flatMap((f) => f.rows).filter((r) => !r.matched).length;
  const c = { id: uid(s, "dc"), at: now(s), day, by: actor.label, entries: s.ledger.length, debit, credit, gateway: bal(s, A.GATEWAY), bank: bal(s, A.BANK), suspense: bal(s, A.SUSPENSE), unmatched, ok: debit === credit };
  s.closes.unshift(c);
  audit(s, actor, "finance.close", `بستن روز · ${c.ok ? "تراز" : "نامتراز"}`, c.id);
  return ok();
}

export function lockPeriod(s: State, actor: Actor, until: number): Result {
  if (until <= s.periodLockedUntil) return fail("تاریخ قفل باید بعد از قفل فعلی باشد.");
  if (until > now(s)) return fail("نمی‌توان دوره‌ی آینده را قفل کرد.");
  s.periodLockedUntil = until;
  audit(s, actor, "finance.lock", `قفل دوره تا ${new Date(until).toISOString().slice(0, 10)}`);
  return ok();
}

/* ───────────────────────── insurance claims ───────────────────────── */

export function openClaim(s: State, actor: Actor, orderId: string, amount: Rial, reason: string): Result<{ id: string }> {
  const o = orderOf(s, orderId);
  if (!o || !o.insurance.productId) return fail("این سفارش بیمه ندارد.");
  if (amount <= 0 || amount > o.insurance.coverage) return fail("مبلغ خسارت از سقف پوشش بیشتر است.");
  const c: Claim = { id: uid(s, "cl"), orderId, productId: o.insurance.productId, at: now(s), amount, reason, status: "OPEN" };
  s.claims.unshift(c);
  audit(s, actor, "claim.open", `${amount / 10} تومان · ${reason}`, c.id);
  return ok({ id: c.id });
}

export function claimAction(s: State, actor: Actor, id: string, to: Claim["status"]): Result {
  const c = s.claims.find((x) => x.id === id);
  if (!c) return fail("پرونده‌ی خسارت پیدا نشد.");
  const o = orderOf(s, c.orderId);
  if (to === "PAID") {
    if (c.status !== "APPROVED" || !o) return fail("فقط خسارت تأییدشده پرداخت می‌شود.");
    const ded = o.insurance.deductible;
    const pay = Math.max(0, c.amount - ded);
    post(s, { key: `claim:${c.id}`, memo: `خسارت بیمه (${c.reason})`, ref: { orderId: o.id, personId: o.shipperId }, lines: [[A.BANK, pay], [A.shipper(o.shipperId), -pay]] });
    notify(s, o.shipperId, "shipper", "refund", `خسارت بیمه ${pay / 10} تومان به کیف پول شما واریز شد.`, "/app/wallet/");
  }
  c.status = to;
  audit(s, actor, `claim.${to.toLowerCase()}`, `${c.id}`, c.id);
  return ok();
}

void DAY;
