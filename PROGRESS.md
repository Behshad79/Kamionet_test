# Progress

## Done
- Audit fixes verified (see git log: Priority 0 / telemetry / Priority 1 commits).
- **M0** foundation: domain v3 (`types.ts`), integer-Rial double-entry ledger, admin-editable config, full engine (orders, pay, payout, trust, admin, stats), per-portal store, deterministic seed that drives the real engine (620 orders, balanced ledger), `npm run test:ledger`.

## In progress
- M1: landing, three-portal shells/auth, demo accounts drawer, persona seeding. (UI from earlier phases is stale until replaced; `src/lib` type-checks.)

## Next
- M2 shipper portal · M3 driver portal · M4 money/rules/mismatch/support/tracking/reviews/certificate · M5 admin console + Demo Director · M6 polish, QA, DEMO_GUIDE.md, deploy

## Resume notes
- Run: `npm run dev`; tests: `npm run test:ledger` (add `--small` for a quick run), `npm run e2e` (legacy, to be rewritten), `npm run test:db`.
- Design system: /DESIGN_SYSTEM.md. Assumptions: /DECISIONS.md.
