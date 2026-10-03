# Progress

## Done
- Audit fixes verified (see git log: Priority 0 / telemetry / Priority 1 commits).
- **M0** foundation: domain v3 (`types.ts`), integer-Rial double-entry ledger, admin-editable config, full engine (orders, pay, payout, trust, admin, stats), per-portal store, deterministic seed that drives the real engine (620 orders, balanced ledger), `npm run test:ledger`.

- **M1** landing (animated Iran map, counters, tabs, Pro, fleet, live loads, FAQ), `/login` chooser + 3 portal logins/sessions, shells with identity cues, demo drawer, personas + scenarios seed (687 orders, 44 open, 14 in transit, payouts, tickets), IndexedDB store, e2e `auth` + `landing`.

- **M2** shipper portal: dashboard (grouped multi-vehicle, to-do, tabs), 5-step wizard (Jalali pickers, temp slider, odor, vehicle illustrations, Pro + driver carousel/profile, insurance picker, terms, recurring, draft persistence), order detail (live map + telemetry, timeline, waybill versions, deposit/balance payment, tip, boost, cancel with exact fee, review, tracking link, rebook), wallet/invoices/refunds/arrears, profile (public profile, completeness, prefs, recurring, favorites, rules), payment sheet, e2e `shipper`.

- **M3** driver portal: resumable KYC (identity + checksum, Shahkar mock with 3-attempt lock + fraud flag, selfie, license, vehicle with colour/`PlateInput`/fridge specs/ambient flag, docs expiry, rules), stage screens (in review / rejected / suspended + appeal), list-first marketplace with filters/sort/map/backhaul/declared trips, explicit reserve copy, lock → confirm, direct requests, trip execution per stage (waiting timer, photos with GPS stamp, offline upload queue, OTP delivery, cash declaration, SOS + incident ticket), trips list, wallet (payouts, IBAN holder check, debt, incentives), profile (stats, breakdown, expiry tracker, clean/wash flow, Pro screen, rules), notifications, shipper public profile, PWA manifest + service worker, e2e `driver` (KYC + full trip chain + offline queue, ledger still balanced).

- **UI refresh** (soft-UI + bento + glass, pill tabs, floating tab bar), new vector trucks (5 silhouettes, live colour), admin shell desktop-first + responsive drawer.
- **M4** mismatch flow (driver evidence sheet with formula preview, shipper approve/counter/reject/escalate, pay difference, waybill v2), consignee tracking `/track/?t=` + `/track/demo/` with delivery code, cold-chain certificate (print → PDF), cash confirmation + MONEY_MISMATCH, support widget (3 channels, contextual, thread, CSAT), e2e `m4`.

## In progress
- M5: admin console (modules, DataTable, command palette, RBAC/audit/approvals, finance) + Demo Director.

## Next
- M2 shipper portal · M3 driver portal · M4 money/rules/mismatch/support/tracking/reviews/certificate · M5 admin console + Demo Director · M6 polish, QA, DEMO_GUIDE.md, deploy

## Resume notes
- Run: `npm run dev`; tests: `npm run test:ledger` (add `--small` for a quick run), `npm run e2e` (legacy, to be rewritten), `npm run test:db`.
- Design system: /DESIGN_SYSTEM.md. Assumptions: /DECISIONS.md.
