/* Ledger invariants: run with `npm run test:ledger`. */
import { baseState } from "../src/lib/seed/base";
import { populate } from "../src/lib/seed/populate";
import { checkInvariants, trialBalance } from "../src/lib/ledger";

const small = process.argv.includes("--small");
const now = Date.UTC(2026, 9, 3, 8, 0, 0);
const s = baseState(now);
const t0 = Date.now();
const errors = populate(s, now, small ? { drivers: 20, shippers: 12, orders: 40, open: 5, inTransit: 3 } : undefined as never);
console.log(`seeded: ${s.orders.length} orders, ${s.ledger.length} ledger entries, ${s.payments.length} payments in ${Date.now() - t0}ms`);
const bad = checkInvariants(s);
const byStatus: Record<string, number> = {};
for (const o of s.orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
console.log(byStatus);
console.log(`sim errors: ${errors.length}`, errors.slice(0, 8));
if (bad.length) { console.error("LEDGER INVARIANT FAILURES:\n" + bad.slice(0, 20).join("\n")); process.exit(1); }
const total = trialBalance(s).reduce((n, r) => n + r.debit - r.credit, 0);
if (total !== 0) { console.error("trial balance != 0:", total); process.exit(1); }
console.log("ledger OK");
