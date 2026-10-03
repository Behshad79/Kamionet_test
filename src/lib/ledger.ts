import type { LedgerEntry, Rial, State } from "./types";

/**
 * Immutable double-entry ledger. Debit positive, credit negative; every
 * transaction sums to zero. Balances are always DERIVED, never stored, and
 * corrections are made with new reversing entries.
 */

export type AccountType = "asset" | "liability" | "revenue" | "expense";

export const A = {
  BANK: "BANK",
  GATEWAY: "GATEWAY",
  REV_COMM: "REV:COMM",
  REV_FEES: "REV:FEES",
  INS_PAYABLE: "INS:PAYABLE",
  VAT_PAYABLE: "VAT:PAYABLE",
  EXP_PROMO: "EXP:PROMO",
  EXP_REFUND: "EXP:REFUND",
  SUSPENSE: "SUSPENSE",
  BAD_DEBT: "EXP:BADDEBT",
  EXP_ADJUST: "EXP:ADJUST",
  escrow: (orderId: string) => `ESCROW:${orderId}`,
  shipper: (pid: string) => `W:S:${pid}`,
  shipperAr: (pid: string) => `AR:S:${pid}`,
  shipperCredit: (pid: string) => `AR:SC:${pid}`,
  dPending: (pid: string) => `W:D:${pid}:pending`,
  dAvail: (pid: string) => `W:D:${pid}:avail`,
  dHold: (pid: string) => `W:D:${pid}:hold`,
  dDebt: (pid: string) => `AR:D:${pid}`,
};

export function accountType(a: string): AccountType {
  if (a === A.BANK || a === A.GATEWAY || a === A.SUSPENSE || a.startsWith("AR:")) return "asset";
  if (a.startsWith("REV:")) return "revenue";
  if (a.startsWith("EXP:")) return "expense";
  return "liability";
}

export const ACCOUNT_LABELS: Record<string, string> = {
  [A.BANK]: "حساب بانکی تسویه",
  [A.GATEWAY]: "انتظار درگاه (Gateway Clearing)",
  [A.REV_COMM]: "درآمد کارمزد",
  [A.REV_FEES]: "درآمد جرائم و خدمات",
  [A.INS_PAYABLE]: "بدهی به بیمه‌گر",
  [A.VAT_PAYABLE]: "مالیات بر ارزش افزوده پرداختنی",
  [A.EXP_PROMO]: "هزینه‌ی تبلیغات و مشوق‌ها",
  [A.EXP_REFUND]: "بازپرداخت‌ها",
  [A.SUSPENSE]: "معلق (Suspense)",
  [A.BAD_DEBT]: "مطالبات سوخت‌شده",
  [A.EXP_ADJUST]: "تعدیل‌های دستی",
};

export function accountLabel(a: string): string {
  if (ACCOUNT_LABELS[a]) return ACCOUNT_LABELS[a];
  if (a.startsWith("ESCROW:")) return "امانی سفارش";
  if (a.startsWith("W:S:")) return "کیف پول صاحب بار";
  if (a.startsWith("AR:S:")) return "بدهی صاحب بار";
  if (a.startsWith("W:D:") && a.endsWith(":pending")) return "کیف پول راننده · در انتظار";
  if (a.startsWith("W:D:") && a.endsWith(":avail")) return "کیف پول راننده · قابل برداشت";
  if (a.startsWith("W:D:") && a.endsWith(":hold")) return "کیف پول راننده · در حال برداشت";
  if (a.startsWith("AR:D:")) return "بدهی کارمزد راننده";
  return a;
}

export interface PostInput {
  /** Idempotency key: re-posting the same key is a no-op. */
  key: string;
  memo: string;
  ref?: LedgerEntry["ref"];
  lines: [account: string, amount: Rial][];
}

export class LedgerError extends Error {}

const clock = (s: State) => s._now ?? Date.now();

export function post(s: State, tx: PostInput): string | null {
  if (s.txKeys[tx.key]) return null;
  const lines = tx.lines.filter(([, a]) => a !== 0);
  if (!lines.length) return null;
  const sum = lines.reduce((n, [, a]) => n + a, 0);
  if (sum !== 0) throw new LedgerError(`unbalanced transaction ${tx.key}: ${sum}`);
  if (lines.some(([, a]) => !Number.isInteger(a))) throw new LedgerError(`non-integer amount in ${tx.key}`);
  const at = clock(s);
  if (at < s.periodLockedUntil) throw new LedgerError("دوره‌ی مالی بسته شده است و ثبت سند با تاریخ گذشته مجاز نیست.");
  const txId = `tx-${(++s.seq).toString(36)}`;
  for (const [account, amount] of lines) {
    s.ledger.push({ id: `le-${(++s.seq).toString(36)}`, txId, at, account, amount, memo: tx.memo, ref: tx.ref });
  }
  s.txKeys[tx.key] = txId;
  cache.delete(s.ledger);
  return txId;
}

const cache = new WeakMap<LedgerEntry[], Map<string, number>>();
function index(s: State) {
  let m = cache.get(s.ledger);
  if (!m) {
    m = new Map();
    for (const e of s.ledger) m.set(e.account, (m.get(e.account) ?? 0) + e.amount);
    cache.set(s.ledger, m);
  }
  return m;
}

/** Raw balance: debit positive. */
export const raw = (s: State, account: string) => index(s).get(account) ?? 0;

/** Natural balance: assets/expenses as debit, liabilities/revenue as credit (always read this for display). */
export function bal(s: State, account: string) {
  const r = raw(s, account);
  const t = accountType(account);
  return t === "asset" || t === "expense" ? r : -r;
}

export interface Wallet {
  available: Rial;
  held: Rial;
  pending: Rial;
  debt: Rial;
}

export function shipperWallet(s: State, pid: string): Wallet {
  return { available: bal(s, A.shipper(pid)), held: s.orders.filter((o) => o.shipperId === pid && activeEscrow(o.status)).reduce((n, o) => n + bal(s, A.escrow(o.id)), 0), pending: 0, debt: bal(s, A.shipperAr(pid)) };
}

export function driverWallet(s: State, pid: string): Wallet {
  return { available: bal(s, A.dAvail(pid)), held: bal(s, A.dHold(pid)), pending: bal(s, A.dPending(pid)), debt: bal(s, A.dDebt(pid)) };
}

const activeEscrow = (st: string) => !["COMPLETED", "CANCELLED_BY_SHIPPER", "CANCELLED_BY_DRIVER", "CANCELLED_BY_SYSTEM", "EXPIRED", "DELIVERED"].includes(st);

export function trialBalance(s: State) {
  const m = index(s);
  const rows = [...m.entries()].map(([account, r]) => ({ account, type: accountType(account), debit: r > 0 ? r : 0, credit: r < 0 ? -r : 0 }));
  return rows.sort((a, b) => a.account.localeCompare(b.account));
}

/** Checks the three ledger invariants. Returns a list of human-readable failures (empty = healthy). */
export function checkInvariants(s: State): string[] {
  const bad: string[] = [];
  const total = s.ledger.reduce((n, e) => n + e.amount, 0);
  if (total !== 0) bad.push(`sum of all entries = ${total}, expected 0`);
  const perTx = new Map<string, number>();
  for (const e of s.ledger) perTx.set(e.txId, (perTx.get(e.txId) ?? 0) + e.amount);
  for (const [tx, v] of perTx) if (v !== 0) bad.push(`transaction ${tx} unbalanced by ${v}`);
  if (s.ledger.some((e) => !Number.isInteger(e.amount))) bad.push("non-integer amount present");
  // derived == independently recomputed
  const direct = new Map<string, number>();
  for (const e of s.ledger) direct.set(e.account, (direct.get(e.account) ?? 0) + e.amount);
  for (const [a, v] of direct) if (raw(s, a) !== v) bad.push(`index mismatch on ${a}`);
  // No customer wallet may be negative (debt/arrears live in their own receivable accounts).
  for (const [a, v] of direct) {
    if ((a.startsWith("W:S:") || (a.startsWith("W:D:"))) && -v < 0) bad.push(`negative wallet ${a}: ${-v}`);
  }
  return bad;
}
