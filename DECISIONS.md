# Decisions & assumptions (confirm with the client)

Each item: **decision** · why · what to confirm.

## Architecture
1. **Three portals, three sessions.** `/app` (shipper), `/driver`, `/admin`; each has its own login and its own session key, so a person can be signed into the driver app in one tab and the shipper panel in another (like two separate phone apps). There is no in-session switch; the *Person* owns optional ShipperProfile/DriverProfile. Backend rule `shipper person ≠ driver person` is enforced on create and claim.
2. **Prototype backend = browser storage.** One shared blob in `localStorage` (cross-tab synced) behind an action layer that mirrors the future server API (atomic transitions, audit log, idempotency keys). Postgres schema in `supabase/` is the production target. Confirm: when to start the real backend.
3. **Static export** so the prototype deploys anywhere. Each portal can later move to its own subdomain (no cross-portal imports except `lib/` and `components/ui`).
4. **PWA** for the driver app: manifest + service worker (cache of app shell) + offline upload queue with retry; real push is stubbed.

## Money
5. **Rial storage, Toman display.** All amounts are integer Rial; one formatter converts to Toman.
6. **Commission default 20 %** (earlier client decision), segment overrides: Pro 18 %, ambient 15 %, tips 0 %. All in the config table, with history and effective dates.
7. **Insurance 0.3 % of declared cargo value; cancellation schedule and deposit 10 %** are defaults in config. Three products (Basic / Standard / Comprehensive) with their own rate, cap % of declared value and deductible. Insurer names are fictional.
8. **Invoicing model switch BROKER vs MARKETPLACE** is in config (default BROKER). **Needs accountant/legal confirmation**: who is the legal seller of freight changes VAT and the tax-invoice obligations. VAT default 0 % (taxable lines configurable). Moodian (مودیان) and electronic waybill are **stubs**.
9. **Commission-secured minimum online payment** = max(deposit %, (commission + insurance + fees + VAT on those) / total). The remainder can be cash to the driver only if enabled for both parties.
10. Mock payment gateway simulates success / failure / cancel / timeout / double-callback / delayed-callback.

## Product
11. **Vehicle taxonomy**: 10 selectable kinds grouped into 5 vector silhouettes (pickup, small box, mid, heavy, trailer). Default payloads are estimates and editable per vehicle.
12. **License plate**: the layout (blue strip, 2 digits, letter, 3 digits, «ایران» + 2-digit province code) follows the common Iranian plate. **I am not certain** which plate colour/letter series applies to goods vehicles (public transport plates are normally yellow, private white). `PlateInput` supports `variant` (`private | public | commercial`) and defaults goods vehicles to `public` (yellow). The allowed-letter list is the common set, not an official table. **Confirm with a traffic-police/ministry source before launch.**
13. **Shahkar (national-ID ↔ SIM match)** is mocked: last digit of the national ID decides success/mismatch for demo; 3 attempts then a fraud flag.
14. **Blind reviews** reveal when both sides submit or after 7 days (config).
15. **Smart auto-assign** = weighted random among eligible Pro drivers (weight = rating² × on-time), explained to the shipper in plain copy.
16. **Settlement**: delivered (consignee OTP) → driver *Pending* → *Available* after a 24 h dispute window (config). Instant payout carries a fee (config).
17. **Mismatch** price formula: weight/volume delta × per-kg share of the freight, bounded by admin-set min/max adjustment.
18. **Excel export** is SpreadsheetML (.xls) generated client-side (opens in Excel); CSV has a UTF-8 BOM. No third-party spreadsheet library.
19. **Rules texts** are realistic Persian drafts and **must go through legal review**.
20. **Telemetry is simulated** and labelled as such everywhere.
21. **Persian map tiles** need a provider key (Neshan / Map.ir). Until then OpenStreetMap restricted to Iran; set `NEXT_PUBLIC_TILE_URL`.

## Demo
22. All demo accounts use OTP `12345`, gated by `NEXT_PUBLIC_DEMO_MODE` (default on for the prototype).
23. Seed is deterministic (seeded RNG); regenerate from the Demo Director or `localStorage` reset.
24. **Persistence moved to IndexedDB** (+ BroadcastChannel across tabs): the deterministic seed is ~4.5 MB, over a comfortable localStorage budget. Per-portal sessions stay in sessionStorage/localStorage.
25. **Demo personas** (drivers 09100000001–13, shippers 09120000001–08) are my interpretation of the persona list: new / in-review / rejected / verified / history-rich / clean badge / Pro-invited / Pro×2 / suspended+appeal / debt / dry truck / declared backhaul trip; shippers: empty / individual / verified company / credit-invoicing / cash-to-driver / overdue / wallet-rich / recurring. Adjust if your list differs.
26. **Iran map on the landing is a stylised outline** (not a surveyed border); real tiles need a provider key.

## M5
27. **Test mode is lenient on identity**: any 10-digit national ID passes the checksum and any IBAN-shaped string is accepted; the match step is controlled by the Demo Director (`idMatch`, `ibanHolder`). Production must restore checksum + real Shahkar/IBAN inquiry.
28. **Truck art** derives from Noto Emoji (Apache-2.0) with colour-role recolouring; keep the attribution if shipped. Bank names in the transaction sheet are fictional.
29. **Deposit-miss policy**: while a driver's confirmation waits for the deposit he is frozen (cannot lock another load); after `deposit.maxMisses` drivers fail to see a deposit the order is auto-cancelled and the shipper is warned (push + SMS).
30. **Admin permissions**: a module's `perm` may be any-of; finance sub-modules share `finance.view` for visibility while actions check their own permission and approval ceilings (`CEILINGS`). Refunds/adjustments/payouts/write-offs above the ceiling need a second approver and the requester can never approve their own request.
31. **Demo Director** only calls the production engine (no ledger shortcuts) and is shown to super/ops/finance_mgr in demo mode.
32. **Seed finance back-office** (invoices/aging, claims, reconciliation files with unmatched rows, closes, locked period, approvals, risk flags, SMS log) is synthetic; tickets are seeded as a believable mix of new / handled / overdue.
