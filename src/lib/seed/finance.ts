import { R } from "../money";
import { A, driverWallet } from "../ledger";
import { adminActor, requestApproval, setConfigValue } from "../engine/admin";
import { DAY, HOUR, audit, orderOf, uid } from "../engine/core";
import { buildReconFile, dailyClose, lockPeriod, matchRecon, openClaim, claimAction, parkInSuspense } from "../engine/finance";
import { markOverdue, issueInvoice, payInvoice, createRefund } from "../engine/payout";
import { pay } from "../engine/pay";
import type { State, Order } from "../types";
import { runOrder, topUp, type Sim } from "./history";

const done = (s: State): Order[] => s.orders.filter((o) => o.status === "COMPLETED");

/** Finance back-office scenarios: refunds, claims, invoices with aging, recon files with unmatched rows, approvals, a locked period. */
export function seedFinance(sim: Sim, now: number) {
  const { s, r } = sim;
  const fm = s.admins.find((a) => a.role === "finance_mgr")!;
  const op = adminActor(s, fm.id);

  // Enterprise invoices: credit orders spread over ~100 days, then invoiced per period with different aging.
  const enterprise = s.shippers.filter((x) => x.controls.creditTermsDays > 0);
  const drivers = s.drivers.filter((d) => d.kyc.status === "verified" && !d.suspension && d.vehicle.minTemp !== null);
  const small = drivers.filter((d) => d.vehicle.kind === "kamionet" || d.vehicle.kind === "nissan");
  for (const sh of enterprise) {
    const created: Order[] = [];
    for (let i = 0; i < 6; i++) {
      sim.t = now - (100 - i * 11) * DAY; s._now = sim.t;
      const dd = r.pick(small.length ? small : drivers);
      const o = runOrder(sim, sh.personId, dd.personId, "completed", { terms: "PREPAID" }, "credit");
      if (o?.status === "COMPLETED") created.push(o);
    }
    const periods = [created.slice(0, 2), created.slice(2, 4), created.slice(4)];
    const ages = [75, 40, 10];
    periods.forEach((list, k) => {
      if (!list.length) return;
      sim.t = now - ages[k] * DAY; s._now = sim.t;
      const amount = list.reduce((n, o) => n + (s.payments.filter((p) => p.orderId === o.id && p.method === "credit" && p.status === "SUCCEEDED").reduce((m, p) => m + p.amount, 0)), 0);
      if (amount <= 0) return;
      const inv = issueInvoice(s, "tax_invoice", sh.personId, amount, list.map((o) => ({ label: `${o.origin.city} ← ${o.dest.city}`, amount: o.freight })), { dueAt: sim.t + sh.controls.creditTermsDays * DAY });
      if (k === 0 && sh.controls.creditTermsDays === 30) { topUp(sim, sh.personId, amount); payInvoice(s, sh.personId, inv.id, "wallet"); }
      if (k === 0) inv.dunning.push({ at: now - 60 * DAY, channel: "SMS" }, { at: now - 50 * DAY, channel: "تماس" });
    });
  }
  s._now = now;
  markOverdue(s);

  // Refunds (some above the finance-operator ceiling so approvals queue up)
  const sample = r.shuffle(done(s)).slice(0, 34);
  sample.forEach((o, i) => {
    sim.t = now - r.int(1, 90) * DAY; s._now = sim.t;
    const amount = R(r.pick([200_000, 500_000, 800_000, 1_500_000, 4_000_000, 9_000_000]));
    createRefund(s, op, { payerId: o.shipperId, orderId: o.id, amount, to: i % 4 === 0 ? "card" : "wallet", reason: r.pick(["جبران تأخیر", "خسارت دمایی", "کرایه‌ی اشتباه", "مغایرت صورت‌حساب"]) }, i % 3 === 0 ? R(100_000) : Infinity);
  });
  s._now = now;

  // Insurance claims
  const insured = done(s).filter((o) => o.insurance.productId).slice(0, 10);
  insured.forEach((o, i) => {
    const adm = adminActor(s, fm.id);
    const res = openClaim(s, adm, o.id, Math.round(o.insurance.coverage * r.pick([0.1, 0.25, 0.4]) / 1000) * 1000, r.pick(["انحراف دما و فساد بخشی از بار", "تصادف و آسیب به بسته‌ها", "سرقت بخشی از محموله"]));
    if (!res.ok) return;
    const c = s.claims[0];
    if (i % 4 === 1) claimAction(s, adm, c.id, "REVIEW");
    if (i % 4 === 2) claimAction(s, adm, c.id, "APPROVED");
    if (i % 4 === 3) { claimAction(s, adm, c.id, "APPROVED"); claimAction(s, adm, c.id, "PAID"); }
  });

  // Pending four-eyes approvals
  const sh0 = s.shippers[3];
  requestApproval(s, op, { action: "adjust", title: `تعدیل ${R(25_000_000) / 10} تومان برای ${sh0.displayName}`, amount: R(25_000_000), payload: { personId: sh0.personId, portal: "shipper", delta: R(25_000_000), reason: "جبران خسارت توافقی" } });

  // Reconciliation: gateway + bank files for the last 3 days, matched; a couple of leftovers parked in suspense
  for (let d = 3; d >= 1; d--) {
    sim.t = now - d * DAY + 20 * HOUR; s._now = sim.t;
    const f = buildReconFile(s, "gateway", now - (d + 20) * DAY, now - d * DAY + DAY);
    s.recon.unshift(f);
    matchRecon(s, f.id);
  }
  const bank = buildReconFile(s, "bank", now - 40 * DAY, now - 1 * DAY);
  s.recon.unshift(bank);
  matchRecon(s, bank.id);
  const un = bank.rows.find((x) => !x.matched);
  if (un) parkInSuspense(s, op, bank.id, un.ref);
  s._now = now;

  // Admin activity (config changes, logins) so the audit trail is alive
  const sup = s.admins.find((a) => a.role === "super")!;
  sim.t = now - 6 * DAY; s._now = sim.t;
  setConfigValue(s, sup.id, "waiting.feePerHour", R(350_000));
  setConfigValue(s, sup.id, "commission.pro", 0.17, now + 5 * DAY);
  for (let i = 0; i < 24; i++) {
    sim.t = now - r.int(1, 120) * HOUR; s._now = sim.t;
    const a = r.pick(s.admins);
    audit(s, adminActor(s, a.id), r.pick(["login", "orders.view", "kyc.approve", "ticket.reply", "export.csv"]), r.pick(["ورود به کنسول", "مشاهده‌ی سفارش", "تأیید مدارک راننده", "پاسخ به تیکت", "خروجی CSV رانندگان"]));
  }
  s._now = now;

  // Risk flags, closed days and a locked period (last, so earlier postings stay valid)
  s.risk.unshift(
    { id: uid(s, "rk"), at: now - 2 * DAY, kind: "چند حساب با یک شبا", personId: drivers[2].personId, severity: "high", detail: "شبای یکسان در ۲ حساب راننده", status: "OPEN" },
    { id: uid(s, "rk"), at: now - 5 * DAY, kind: "الگوی لغو مکرر", personId: s.shippers[5].personId, severity: "medium", detail: "۴ لغو در ۷ روز", status: "REVIEW" },
    { id: uid(s, "rk"), at: now - 9 * DAY, kind: "استفاده‌ی مکرر از کد تخفیف", personId: s.shippers[9].personId, severity: "low", detail: "۳ حساب با یک موبایل پشتیبان", status: "CLEARED" },
  );
  for (let d = 5; d >= 1; d--) { sim.t = now - d * DAY + 23 * HOUR; s._now = sim.t; dailyClose(s, op, new Date(now - d * DAY).setHours(0, 0, 0, 0)); }
  s._now = now;
  lockPeriod(s, op, now - 30 * DAY);
  void orderOf; void pay; void A; void driverWallet;
}
