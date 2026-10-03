# Kamionet — Design System (v2)

> Generated once with the UI/UX ProMax skill (`--design-system`, three runs: driver / admin / shipper intent) and then bound to the Kamionet brand.
> Skill verdict: **Minimalism & Swiss, real-time/operations pattern** → clean, spacious, high contrast, grid based, label telemetry honestly.
> The skill's stock palette/fonts are overridden by brand decisions below. Every UI change must pass the skill's pre-delivery checklist
> (SVG icons only, ≥44px targets, 4.5:1 text contrast, visible focus, `prefers-reduced-motion`).

## 1. Foundations

| Item | Decision |
|---|---|
| Direction / language | RTL, Persian (formal «شما»). All UI copy native Persian. |
| Font | Vazirmatn variable, self-hosted (`vazirmatn` npm). Base 16px, line-height 1.6 body, 1.35 headings. |
| Digits | Persian digits everywhere. Inputs accept Latin/Arabic digits and normalize (`normalizeDigits`). |
| Calendar | Jalali only. `JalaliDatePicker` / `JalaliDateTimePicker`; `Intl fa-IR-u-ca-persian` for display. |
| Money | Stored as **integer Rial**. One formatter (`lib/money.ts`) → Toman, Persian digits, "میلیون/میلیارد" spelled out. |
| Mode | Light only. `color-scheme: light`. |
| Icons | Lucide, one set. No emoji as icons. |

## 2. Tokens

### 2.1 Brand (constant)
`brand-500 #FFB000` (yellow, primary CTA) · `accent-600 #146EB4` (blue) · `accent-500 #00A8E1` · ink `#111827` · ink-2 `#374151` · ink-3 `#5B6472` · line `#E5E7EB`.
Status: ok `#12703A` / bg `#DCFCE7`, warn `#B13A0B` / bg `#FFEDD5`, danger `#B91C1C` / bg `#FEE2E2`, info `#0F5590` / bg `#E8F6FC`.
Never convey status by colour alone: always icon + text.

### 2.2 Semantic tokens per portal (re-skin through `data-portal` on the portal wrapper)

| Token | Shipper `app` (blue-led) | Driver `driver` (yellow-led) | Admin `admin` (slate) |
|---|---|---|---|
| `--tint` page ground | `#F5FAFE` | `#FFFBEB` | `#F8FAFC` |
| `--act` active/selected | accent-600 | brand-500 | slate-700 `#334155` |
| `--act-soft` selected bg | accent-50 `#E8F6FC` | brand-100 `#FFEFC2` | slate-100 `#F1F5F9` |
| `--act-ink` text on soft | accent-700 | ink | slate-800 |
| primary CTA | brand yellow | brand yellow | brand yellow (sparingly) |
| nav surface | white | white | slate-900 `#0F172A` sidebar |
| identity cue (header) | «پنل صاحب بار» | «اپ راننده» | «مدیریت» |

Tailwind classes: `bg-tint`, `bg-act-soft`, `text-act-ink`, `border-act`, `bg-act`.
Yellow and blue are **accents**: never flood a whole surface with them.

### 2.3 Pro tier
Deep navy `#0B1B3A` → gold `#F5C451` gradient (`.pro-badge`, `.pro-card`), subtle shine sweep (disabled under reduced motion). Used identically in driver, shipper and landing.

### 2.4 Scales
- Radius: one token `--radius-ui: 14px` (`rounded-ui`); pills `rounded-full`; sheets top-radius 24px.
- Elevation: `shadow-soft` (cards), `shadow-lift` (sheets, popovers). No heavy borders.
- Spacing: 4px base; page gutter 16px; card padding 16–20px; driver tap targets ≥48px, elsewhere ≥44px.
- Density: shipper standard, driver comfortable (large), admin dense (tables 40px rows, 13px text min).

## 3. Components (atoms → organisms)

Atoms: Button (primary/secondary/ghost/danger/accent) · ButtonLink · Input · NumInput · Select · Toggle · Badge · Chip · Skeleton · Stars · Progress · Spinner.
Molecules: Field · Card · EmptyState · Stat · Modal · **Sheet** (bottom sheet, mobile; modal on desktop) · **Drawer** · Tabs · Accordion · Stepper · Timeline · CountUp · Countdown.
Domain: OrderCard · OrderGroupCard · TempChip · TempGauge · TempPanel · StatusTimeline · TruckIllustration · PlateInput · InsurerLogo/BrandLogo · ProBadge · CleanBadge · OdorChip · CargoIcon · PriceBreakdown · PaymentSheet · SupportWidget · ReviewForm · RuleCard.
Admin: DataTable (search, filters, sort, column chooser, bulk, CSV/Excel export, saved views, row drawer) · CommandPalette · PermissionGuard · AuditTrail · LineChart/BarChart/Sparkline.

## 4. Layout patterns
- **Driver**: mobile-first PWA, bottom tab bar (≤5), sticky bottom action bar, one-handed thumb zone, offline-tolerant upload queue chip.
- **Shipper**: responsive, desktop-first with side nav ≥1024px, top nav + bottom bar below.
- **Admin**: desktop-only, 240px dark sidebar, breadcrumb, dense tables, Ctrl/Cmd+K.
- Every list/table/map: designed empty, skeleton loading and error state **with a recovery action**.

## 5. Motion
150–300ms. Springy sheets/cards (`cubic-bezier(.2,.9,.3,1.2)`), skeleton shimmer, count-up numbers, animated route dash, pulse on live markers, shine on Pro. Everything is neutralised by `prefers-reduced-motion`.

## 6. Copy tone
Warm, concise, respectful, formal «شما». Name things by what people recognise. Errors say what happened and what to do next. Money copy always shows the exact amount before a destructive action. Never "بدون واسطه"; positioning is «مستقیم، شفاف، بیمه‌شده».
Commission is **never** shown to shippers; each side sees its own perspective.

## 7. Accessibility
WCAG AA contrast (validated), visible 2px focus ring, Persian ARIA labels, keyboard operable everywhere (combobox pattern, dialog focus trap, Esc), no colour-only meaning, `aria-live` for toasts/countdown milestones, tabular numbers for amounts.
