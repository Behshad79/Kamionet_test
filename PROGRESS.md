# Progress

## Done
- Audit fixes verified (see git log: Priority 0 / telemetry / Priority 1 commits).
- **M0** foundation: domain v3 (`types.ts`), integer-Rial double-entry ledger, admin-editable config, full engine (orders, pay, payout, trust, admin, stats), per-portal store, deterministic seed that drives the real engine (620 orders, balanced ledger), `npm run test:ledger`.

- **M1** landing (animated Iran map, counters, tabs, Pro, fleet, live loads, FAQ), `/login` chooser + 3 portal logins/sessions, shells with identity cues, demo drawer, personas + scenarios seed (687 orders, 44 open, 14 in transit, payouts, tickets), IndexedDB store, e2e `auth` + `landing`.

- **M2** shipper portal: dashboard (grouped multi-vehicle, to-do, tabs), 5-step wizard (Jalali pickers, temp slider, odor, vehicle illustrations, Pro + driver carousel/profile, insurance picker, terms, recurring, draft persistence), order detail (live map + telemetry, timeline, waybill versions, deposit/balance payment, tip, boost, cancel with exact fee, review, tracking link, rebook), wallet/invoices/refunds/arrears, profile (public profile, completeness, prefs, recurring, favorites, rules), payment sheet, e2e `shipper`.

- **M3** driver portal: resumable KYC (identity + checksum, Shahkar mock with 3-attempt lock + fraud flag, selfie, license, vehicle with colour/`PlateInput`/fridge specs/ambient flag, docs expiry, rules), stage screens (in review / rejected / suspended + appeal), list-first marketplace with filters/sort/map/backhaul/declared trips, explicit reserve copy, lock → confirm, direct requests, trip execution per stage (waiting timer, photos with GPS stamp, offline upload queue, OTP delivery, cash declaration, SOS + incident ticket), trips list, wallet (payouts, IBAN holder check, debt, incentives), profile (stats, breakdown, expiry tracker, clean/wash flow, Pro screen, rules), notifications, shipper public profile, PWA manifest + service worker, e2e `driver` (KYC + full trip chain + offline queue, ledger still balanced).

- **UI refresh** (soft-UI + bento + glass, pill tabs, floating tab bar), new vector trucks (5 silhouettes, live colour), admin shell desktop-first + responsive drawer.
- **M4** mismatch flow (driver evidence sheet with formula preview, shipper approve/counter/reject/escalate, pay difference, waybill v2), consignee tracking `/track/?t=` + `/track/demo/` with delivery code, cold-chain certificate (print → PDF), cash confirmation + MONEY_MISMATCH, support widget (3 channels, contextual, thread, CSAT), e2e `m4`.

- **User-fix batch (M5 preface)**: test-mode lenient national ID/IBAN, exact pin + address on order (driver sees both only after deposit), coupon apply/remove, flat buttons, full wallet transaction sheet (time, bank, terminal, RRN…), messenger-style profiles, real shipper completeness, mandatory document photos, Pro journey (levels, gamification, scheduled inspection slots, manual Pro by staff, crown ring), support phone call, deposit-wait freeze + auto-cancel with warnings, push + SMS, recurring-orders page, rebuilt waybill with Kamionet seal.
- **M5** admin console (desktop-first, mobile drawer): 30 modules behind a catch-all route (`/admin/[[...m]]`) driven by `adminNav.ts` (sidebar, palette and route table share one list), RBAC per module + Denied page on direct URLs, `DataTable` (search, filters, sort, columns, bulk, saved views, CSV/Excel), dashboard + live ops, orders/dispatch/disputes, drivers 360 / KYC / shippers / Pro inspections, finance (overview + trial balance + invariants, receipts, payouts + batches, refunds, debts ladder, invoices aging, reconciliation + suspense + daily close + period lock, coupons/incentives, claims), support center with macros/SLA, config editor (scheduled changes + history), team matrix + ceilings, four-eyes approvals, audit, rules CMS, reviews, washes, risk, broadcasts + SMS log, master data, system health. Ctrl/⌘+K command palette and Demo Director (real engine actions). e2e `admin` (all modules, palette, config audit, director→ledger balanced, RBAC, mobile drawer).

## In progress
- M6: polish, QA at 375/768/1280, DEMO_GUIDE.md, deploy.

## Resume notes
- Run: `npm run dev`; tests: `npm run test:ledger` (add `--small` for a quick run), `npm run e2e` (legacy, to be rewritten), `npm run test:db`.
- Design system: /DESIGN_SYSTEM.md. Assumptions: /DECISIONS.md.
