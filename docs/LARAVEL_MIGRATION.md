# سند انتقال کامیونت به Laravel (V1)

> مرجع رفتاری: همین ریپو (پروتوتایپ Next.js، موتور در `src/lib/engine`). مرجع استک: Spec پروژه.
> مخاطب: تیم Backend (Laravel)، تیم Flutter، تیم ادمین Next.js.
> وضعیت: پیش‌نویس فنی. موارد بخش ۱۰ پیش از شروع اسپرینت Backend باید توسط مدیر پروژه بسته شوند.

---

## ۰. تصمیم پایه

| موضوع | پروتوتایپ | محصول V1 |
|---|---|---|
| Backend | موتور TypeScript داخل مرورگر + IndexedDB | Laravel REST API + MySQL 8 + Redis |
| Real-time | BroadcastChannel بین تب‌ها | Laravel Reverb (WebSocket) |
| اپ صاحب بار و راننده | صفحات Next.js + PWA | Flutter (iOS، Android، PWA) |
| ادمین | `/admin` داخل همین ریپو | Next.js SPA جدا، فقط از طریق API |
| سایت و CMS | صفحات استاتیک + `blog.ts` | Laravel + Livewire + Filament |
| دیتابیس هدف | `supabase/migrations` (Postgres) | **منسوخ.** این migrationها فقط مدل قدیمی v2 را پوشش می‌دهند و از موتور فعلی عقب‌اند. مبنای طراحی جداول، `src/lib/types.ts` و موتور است، نه این SQL. |

قاعده: هر منطق تجاری که در `src/lib/engine/*` هست باید در Laravel به یک **Action/Service سمت سرور** تبدیل شود. Flutter و ادمین هیچ قاعده‌ی پولی، وضعیتی یا دسترسی را خودشان محاسبه نمی‌کنند.

---

## ۱. نگاشت ماژول‌ها

| پروتوتایپ | Laravel |
|---|---|
| `lib/types.ts` | Migrations + Eloquent Models + Enums (`OrderStatus`, `PaymentStatus`, `PayoutStatus`, `KycStatus`, `AdminRole`) |
| `lib/config.ts` | جدول `app_configs` (key, value JSON, effective_at, changed_by) + `config_changes` (تاریخچه و تغییر زمان‌بندی‌شده) + کش Redis |
| `engine/orders.ts` | `OrderService` + Actions: `CreateOrder`, `ClaimOrder`, `ConfirmAssignment`, `AcceptDirect`, `StartToPickup`, `ArrivePickup`, `StartTrip`, `ArriveDelivery`, `Deliver`, `CancelByShipper`, `CancelByDriver`, `ReportMismatch`, ... |
| `engine/pay.ts` + `ledger.ts` | `LedgerService::post()` + `PaymentService` + `SettlementService` |
| `engine/payout.ts` | `PayoutService` + صف تأیید دونفره |
| `engine/kyc.ts`, `drivers.ts` | `KycService`, `DriverEligibility` |
| `matching.ts` | `MatchingService` (تطبیق خودرو، دما، پرو) |
| `mask.ts` | سه API Resource: `OrderGuestResource`, `OrderPublicResource`, `OrderFullResource` + Policy |
| `engine/comms.ts` | چت با Reverb + `ComplaintService`. **بخش تماس درون‌برنامه‌ای حذف می‌شود** (بخش ۹). |
| `engine/admin.ts` (`ROLE_PERMS`, `CEILINGS`) | `spatie/laravel-permission` + `ApprovalService` (four-eyes) |
| `engine/trust.ts` | تیکت، امتیاز، شکایت |
| `orders.ts::engineTick` | چند Job زمان‌بندی‌شده (بخش ۷) |
| `telemetry.ts` | **خارج از V1.** فقط بخش موقعیت GPS گوشی راننده منتقل می‌شود. |

---

## ۲. ماشین حالت سفارش

### ۲.۱ وضعیت‌ها
```
DRAFT · OPEN · PRO_POOL · DIRECT_REQUESTED · LOCKED · AWAITING_DEPOSIT · ASSIGNED
EN_ROUTE_TO_PICKUP · AT_PICKUP · MISMATCH_REVIEW · IN_TRANSIT · AT_DELIVERY
DELIVERED · COMPLETED
CANCELLED_BY_SHIPPER · CANCELLED_BY_DRIVER · CANCELLED_BY_SYSTEM · EXPIRED · DISPUTED
```
- **Board** (قابل انتخاب توسط راننده): `OPEN`، `PRO_POOL`
- **پایانی:** `COMPLETED`، همه‌ی `CANCELLED_*`، `EXPIRED`

### ۲.۲ جدول انتقال‌ها

| از | به | عامل | شرط (Guard) | اثر جانبی |
|---|---|---|---|---|
| — | `OPEN` / `PRO_POOL` / `DIRECT_REQUESTED` | صاحب بار | اعتبارسنجی ورودی، `applyFlags` | محاسبه‌ی قیمت، کد تحویل و توکن رهگیری گیرنده |
| `OPEN`/`PRO_POOL` | `LOCKED` | راننده | KYC تأییدشده، معلق نبودن، بدهی کمتر از `debt.restrictAt`، نداشتن سفارش در انتظار بیعانه، تطبیق خودرو/دما/پرو، **حداکثر یک LOCKED برای هر راننده**، راننده ≠ صاحب بار | `locked_until = now + lock.seconds` (۱۵۰ ثانیه) |
| `LOCKED` | Board | راننده یا Job | رهاسازی یا انقضای قفل | اعلان به راننده |
| `LOCKED` | `AWAITING_DEPOSIT` | راننده | `locked_until > now` | `deposit_due_at = now + deposit.dueMin` (۱۰ دقیقه)؛ پرداخت خودکار از کیف پول اگر فعال باشد؛ **باز شدن چت** |
| `DIRECT_REQUESTED` | `AWAITING_DEPOSIT` | راننده‌ی هدف | داخل `direct.windowMin` (۱۰ دقیقه) + همان guardهای claim | مثل ردیف قبل |
| `DIRECT_REQUESTED` | راننده‌ی بعدی / `PRO_POOL` / `OPEN` | Job یا صاحب بار | رد یا انقضا | در حالت SMART چرخش خودکار؛ fallback طبق `match.directFallbackAuto` |
| `AWAITING_DEPOSIT` | `ASSIGNED` | سیستم (callback درگاه) | مبلغ پرداختی ≥ بیعانه‌ی لازم | صدور بارنامه‌ی کامیونت، **رفع ماسک آدرس و شماره** |
| `AWAITING_DEPOSIT` | Board | Job | انقضای مهلت بیعانه | برگشت پرداخت جزئی، `deposit_misses++`، آزادشدن راننده |
| `AWAITING_DEPOSIT` | `CANCELLED_BY_SYSTEM` | Job | `deposit_misses ≥ deposit.maxMisses` (۲) | کاهش امتیاز صداقت صاحب بار، پیامک و اعلان |
| `ASSIGNED` | `EN_ROUTE_TO_PICKUP` | راننده | — | شروع ارسال GPS |
| `EN_ROUTE_TO_PICKUP` | `AT_PICKUP` | راننده | — | شروع شمارش انتظار رایگان |
| `AT_PICKUP` | `MISMATCH_REVIEW` | راننده | شواهد عکس + فرمول | مهلت پاسخ صاحب بار `mismatch.slaMin` |
| `MISMATCH_REVIEW` | `AT_PICKUP` / `CANCELLED_BY_SHIPPER` | صاحب بار / پشتیبانی | تأیید، پیشنهاد متقابل، رد، ارجاع | نسخه‌ی جدید بارنامه؛ پرداخت مابه‌التفاوت |
| `AT_PICKUP` | `IN_TRANSIT` | راننده | عکس بار + عکس فاکتور با مهر زمان و GPS | ارسال پیامک کد تحویل به گیرنده |
| `IN_TRANSIT` | `AT_DELIVERY` | راننده | — | شمارش انتظار در مقصد |
| `AT_DELIVERY` | `DELIVERED` | راننده | **تطبیق OTP گیرنده سمت سرور** + عکس فاکتور تحویل؛ مبلغ نقدی اگر توافق نقدی بوده | محاسبه‌ی هزینه‌ی انتظار، تسویه (بخش ۴)، ماسک دوباره‌ی شماره‌ها |
| `DELIVERED` | `COMPLETED` | Job | `release_at ≤ now` و تسویه hold نشده باشد | انتقال درآمد راننده از Pending به Available |
| Board/`ASSIGNED`/... | `CANCELLED_BY_*` | صاحب بار / راننده / ادمین | جدول لغو (بخش ۴.۴)؛ پس از `IN_TRANSIT` لغو توسط صاحب بار فقط از طریق پشتیبانی | سند لغو در Ledger، strike برای راننده |
| Board | `EXPIRED` | Job | `pickup_to < now − 2h` | اعلان به صاحب بار |

### ۲.۳ تطبیق با ۶ مرحله‌ی سفر در Spec

| Spec | پروتوتایپ |
|---|---|
| در مسیر مبدأ | `EN_ROUTE_TO_PICKUP` |
| رسیدن به مبدأ | `AT_PICKUP` |
| بارگیری شد (عکس) | داخل انتقال `AT_PICKUP → IN_TRANSIT` (وضعیت جدا ندارد) |
| در حال حمل (GPS) | `IN_TRANSIT` |
| رسیدن به مقصد | `AT_DELIVERY` |
| تحویل با OTP | `DELIVERED` |

پیشنهاد: وضعیت `LOADED` جدا ساخته **نشود**. بارگیری و حرکت در عمل یک اقدام راننده است. فقط در اپ، رخداد `loaded_at` به‌عنوان مرحله‌ی سوم تایم‌لاین نمایش داده شود.

### ۲.۴ پیاده‌سازی در Laravel
- جدول `order_status_events` (order_id, from, to, actor_type, actor_id, reason, created_at) **append-only**. معادل `setStatus` + audit.
- هر Action داخل `DB::transaction` با `Order::lockForUpdate()`. شرط وضعیت مبدأ دوباره داخل تراکنش چک شود.
- بعد از commit، Event روی Reverb پخش شود (`OrderStatusChanged`). هرگز داخل تراکنش پخش نشود.

---

## ۳. هم‌زمانی و Idempotency

### ۳.۱ قفل انتخاب بار (Claim)
مسابقه‌ی اصلی سیستم این است که چند راننده هم‌زمان یک بار را بزنند.
```sql
UPDATE orders
   SET status='LOCKED', locked_by=:driver, locked_until=NOW() + INTERVAL :sec SECOND, version=version+1
 WHERE id=:id AND status IN ('OPEN','PRO_POOL') AND version=:v;
-- affected_rows = 0  ⇒  409 «این سفارش هم‌اکنون به راننده دیگری اختصاص یافته است»
```
- قانون «حداکثر یک LOCKED برای هر راننده»: ستون `drivers.active_lock_order_id` با UNIQUE، یا قفل Redis `lock:driver:{id}` با `Cache::lock()`. چک نرم‌افزاری کافی نیست.
- قانون «راننده‌ی منتظر بیعانه بار جدید نمی‌گیرد» هم سمت سرور چک شود.

### ۳.۲ پرداخت
- هر درخواست پرداخت یک `idempotency_key` دارد (UNIQUE). callback تکراری یا دیررس درگاه نباید دو بار ثبت شود. پروتوتایپ این سناریوها را شبیه‌سازی کرده است (`DECISIONS.md` بند ۱۰).
- callback پس از انقضای مهلت بیعانه (سفارش به Board برگشته): پول به کیف پول صاحب بار برود و سفارش تغییر نکند.

### ۳.۳ Ledger
- `ledger_transactions.idem_key` با UNIQUE. معادل `txKeys` در `ledger.ts`. ثبت دوباره‌ی همان کلید بی‌اثر است.

---

## ۴. دفتر کل دوطرفه (Ledger)

### ۴.۱ اصول (همان `ledger.ts`)
- همه‌ی مبالغ **ریال، BIGINT صحیح**. تبدیل به تومان فقط در نمایش.
- بدهکار مثبت، بستانکار منفی. جمع خطوط هر تراکنش **دقیقاً صفر**، وگرنه exception.
- مانده هرگز ذخیره نمی‌شود و از جمع خطوط به دست می‌آید. برای کارایی، snapshot روزانه یا materialized balance با reconcile مجاز است.
- اصلاح فقط با سند معکوس. UPDATE و DELETE روی ledger ممنوع (سطح دسترسی DB).
- قفل دوره: سند با تاریخ قبل از `period_locked_until` رد می‌شود.

### ۴.۲ جداول
```
ledger_transactions (id, idem_key UNIQUE, memo, order_id, person_id, payment_id, payout_id, created_at)
ledger_lines        (id, transaction_id, account, amount BIGINT, created_at)  -- INDEX(account)
```

### ۴.۳ حساب‌ها

| حساب | نوع | توضیح |
|---|---|---|
| `BANK` | دارایی | حساب بانکی تسویه |
| `GATEWAY` | دارایی | انتظار تسویه‌ی درگاه |
| `SUSPENSE` | دارایی | معلق (واریز ناشناس) |
| `ESCROW:{order}` | بدهی | امانی هر سفارش |
| `W:S:{person}` | بدهی | کیف پول صاحب بار |
| `W:D:{person}:pending` / `:avail` / `:hold` | بدهی | کیف پول راننده: در انتظار، قابل برداشت، در حال برداشت |
| `AR:S:{p}`, `AR:SC:{p}`, `AR:D:{p}` | دارایی | بدهی صاحب بار، اعتبار فاکتوری، بدهی کارمزد راننده |
| `INS:PAYABLE`, `VAT:PAYABLE` | بدهی | بیمه‌گر، مالیات |
| `REV:COMM`, `REV:FEES` | درآمد | کارمزد، جریمه و خدمات |
| `EXP:PROMO`, `EXP:REFUND`, `EXP:BADDEBT`, `EXP:ADJUST` | هزینه | تخفیف و مشوق، بازپرداخت، سوخت، تعدیل |

### ۴.۴ دستور ثبت‌های اصلی

| رویداد | خطوط |
|---|---|
| پرداخت درگاه برای سفارش | `GATEWAY +x` / `ESCROW −x` |
| پرداخت از کیف پول | `W:S +x` / `ESCROW −x` |
| تخفیف با هزینه‌ی پلتفرم | `EXP:PROMO +d` / `ESCROW −d` |
| تسویه پس از تحویل | `ESCROW +کل` / `INS:PAYABLE −بیمه` / `VAT −مالیات` / `REV:COMM −کارمزد` / `W:D:pending −سهم راننده` |
| کارمزد سفر نقدی | `AR:D +بدهی` / `REV:COMM −بدهی` (و ورود به نردبان بدهی) |
| آزادسازی پس از پنجره‌ی اعتراض | `W:D:pending +x` / `W:D:avail −x` |
| درخواست برداشت | `W:D:avail +x` / `W:D:hold −x` |
| واریز برداشت | `W:D:hold +x` / `BANK −(x−fee)` / `REV:FEES −fee` |
| برداشت ناموفق | `W:D:hold +x` / `W:D:avail −x` |

- نرخ کارمزد: `commission.standard` ۲۰٪، پرو ۱۸٪، غیریخچالی ۱۵٪، انعام ۰٪. همه از `app_configs` خوانده می‌شوند.
- جدول لغو (`cancelQuote`): ۵ دقیقه‌ی اول پس از تخصیص بازگشت کامل؛ قبل از حرکت ۵۰٪ بیعانه سهم راننده؛ بعد از حرکت ۱۰۰٪ بیعانه + جبران رفت خالی (۱۲۰٬۰۰۰ ریال بر کیلومتر، سقف ۶۰ میلیون ریال)؛ ۱۰٪ جریمه سهم پلتفرم. پیش‌نمایش دقیق مبلغ پیش از تأیید لغو الزامی است.

### ۴.۵ آزمون پذیرش
تست‌های Feature در Laravel باید معادل `tests/ledger.test.ts` باشند: seed کامل (حدود ۷۰۰ سفارش) با Actionهای واقعی اجرا شود و در پایان trial balance صفر و همه‌ی invariantها برقرار باشد. نتیجه‌ی اجرای این تست روی همین branch: ۷۰۶ سفارش، ۷۵۳۸ خط دفتر، صفر خطا.

---

## ۵. حریم خصوصی و ماسک داده

### ۵.۱ سه سطح نمایش سفارش (همان `mask.ts`)

| سطح | چه کسی | چه می‌بیند |
|---|---|---|
| Guest | بدون ورود | شهر مبدأ و مقصد، نوع بار، **بازه‌ی گرد قیمت** |
| Public | راننده‌ی واردشده‌ای که این سفارش را ندارد | محدوده‌ی تقریبی (نه نقطه‌ی دقیق)، فاصله، زمان‌ها، دما، خودرو، وزن، کرایه، پروفایل عمومی صاحب بار |
| Full | صاحب بار؛ راننده‌ی تخصیص‌یافته **فقط از `ASSIGNED` به بعد** | آدرس و پین دقیق، نام گیرنده، بارنامه، مدارک |

### ۵.۲ شماره‌ی تلفن
- فقط در وضعیت‌های `ASSIGNED` تا `AT_DELIVERY` (`PHONE_LIVE`). پیش از بیعانه و پس از تحویل دیده نمی‌شود، روی بارنامه هم ماسک است.
- در V1 تماس فقط با شماره‌گیر گوشی (`tel:`) انجام می‌شود. VoIP و ماسک شماره در V1 نیست.

### ۵.۳ الزامات سمت سرور
- ماسک در **API Resource و Policy** اعمال شود، نه در Flutter. پاسخ API برای نقش غیرمجاز اصلاً فیلد را نداشته باشد.
- کد تحویل گیرنده (OTP): در پروتوتایپ از hash شناسه‌ی سفارش ساخته می‌شود و قابل پیش‌بینی است. در Laravel: `random_int` چهار یا پنج رقمی، ذخیره به‌صورت hash، تطبیق سمت سرور، حداکثر ۵ تلاش در ۱۵ دقیقه، و هرگز در پاسخ API راننده نیاید.
- توکن رهگیری گیرنده: رشته‌ی تصادفی ۳۲ بایتی، قابل ابطال، بدون ورود. فقط وضعیت، موقعیت و کد تحویل گیرنده را نشان دهد.
- مشاهده‌ی متن گفتگو توسط کارکنان فقط با مجوز `comms` و با ثبت در audit.

---

## ۶. نقش‌ها و دسترسی ادمین

| نقش | حوزه |
|---|---|
| `super` | همه |
| `ops` | داشبورد، عملیات زنده، سفارش (مشاهده و اقدام)، dispatch، راننده و صاحب بار (مشاهده)، پرو، اختلاف، پشتیبانی سفر، ریسک، نظرها، پیام همگانی، داده‌ی پایه، اسناد، گفتگوها |
| `support` | داشبورد، گفتگوها، مشاهده‌ی سفارش و افراد، پشتیبانی سفر و حساب، نظرها، اختلاف |
| `kyc` | داشبورد، مشاهده‌ی راننده، بررسی KYC، پشتیبانی حساب |
| `finance_mgr` | همه‌ی `finance.*`، بیمه، قیمت‌گذاری، گزارش و خروجی، ریسک، اختلاف |
| `finance_op` | برداشت، تطبیق، رسید، خروجی مالی |
| `wallet_support` | بازپرداخت، پشتیبانی مالی |
| `accountant` | فقط‌خواندنی مالی و خروجی |

سقف تأیید تک‌نفره (ریال). بالاتر از سقف، تأیید نفر دوم لازم است و درخواست‌دهنده نمی‌تواند تأییدکننده باشد:

| نقش | بازپرداخت | تعدیل | برداشت |
|---|---|---|---|
| `finance_mgr` | ۲٬۰۰۰٬۰۰۰٬۰۰۰ | ۱٬۰۰۰٬۰۰۰٬۰۰۰ | بدون سقف |
| `finance_op` | ۲۰۰٬۰۰۰٬۰۰۰ | ۱۰۰٬۰۰۰٬۰۰۰ | ۱٬۰۰۰٬۰۰۰٬۰۰۰ |
| `wallet_support` | ۵۰٬۰۰۰٬۰۰۰ | ۲۰٬۰۰۰٬۰۰۰ | ۰ |
| سایر نقش‌ها | ۰ | ۰ | ۰ |

پیاده‌سازی: `spatie/laravel-permission` با permission دقیقاً هم‌نام کلیدهای `ROLE_PERMS`. ادمین Next.js منو را از endpoint `/api/admin/me/permissions` می‌سازد و هر endpoint سمت سرور جداگانه authorize می‌کند. 2FA برای همه‌ی نقش‌های ادمین اجباری است (در پروتوتایپ فیلد دارد ولی اعمال نشده).

---

## ۷. Jobهای زمان‌بندی‌شده (جایگزین `engineTick`)

| Job | دوره | کار |
|---|---|---|
| `ExpireLocks` | هر ۱۵ ثانیه، یا delayed job دقیق هنگام قفل | `LOCKED` منقضی → Board |
| `ExpireDeposits` | delayed job در `deposit_due_at` | برگشت به Board یا لغو سیستمی |
| `ExpireDirectRequests` | delayed job در `direct_expires_at` | چرخش SMART یا fallback |
| `ExpireStaleOrders` | هر ۵ دقیقه | Board با `pickup_to < now − 2h` → `EXPIRED` |
| `ReleaseSettlements` | هر ۵ دقیقه | `release_at` رسیده و hold نشده → `COMPLETED` |
| `EscalateMismatches` | delayed job | پاسخ‌نداده → پشتیبانی |
| `EscalateComplaints` | delayed job | بعد از `complaint.replyMin` → تیکت |
| `CloseChats` | هر ۱۵ دقیقه | `chat.afterDoneH` پس از تحویل → فقط‌خواندنی |
| `DebtLadder` | ساعتی | یادآوری، محدودیت، تعلیق |
| `RevealReviews` | ساعتی | آشکارسازی نظر یک‌طرفه بعد از ۷ روز |
| `SpawnRecurring` | هر ۱۵ دقیقه | ساخت سفارش تکرارشونده ۱۲ ساعت قبل از نوبت |
| `ApplyScheduledConfig` | هر دقیقه | اعمال تغییرات زمان‌بندی‌شده‌ی تنظیمات |
| `ProAutoScan` | روزانه | دعوت خودکار رانندگان واجد شرایط پرو |

همه‌ی Jobها idempotent باشند و داخل تراکنش، وضعیت سفارش را دوباره چک کنند. اجرای هم‌زمان دو worker نباید باعث دو انتقال شود.

---

## ۸. کانال‌های Real-time (Reverb)

| کانال | اعضا | رخدادها |
|---|---|---|
| `private-order.{id}` | صاحب بار، راننده‌ی تخصیص‌یافته | `OrderStatusChanged`, `DriverLocation`, `ChatMessage`, `PaymentReceived`, `MismatchUpdated` |
| `private-driver.{id}` | خود راننده | `DirectRequest`, `LockExpired`, `DepositExpired`, `Notification` |
| `private-shipper.{id}` | خود صاحب بار | `DepositDue`, `Notification` |
| `board.{region}` | رانندگان تأییدشده | `OrderPublished`, `OrderTaken` (فقط داده‌ی سطح Public) |
| `private-admin.liveops` | نقش‌های دارای `liveops` | رخدادهای عملیاتی |

GPS راننده: فقط از `EN_ROUTE_TO_PICKUP` تا `DELIVERED`، هر ۱۵ تا ۳۰ ثانیه با فیلتر جابه‌جایی کمتر از ۵۰ متر، از طریق `POST /api/trips/{id}/locations` (دسته‌ای و مقاوم در برابر قطعی). آخرین موقعیت در Redis، تاریخچه در MySQL با پاک‌سازی دوره‌ای. Reverb فقط آخرین نقطه را پخش می‌کند.

---

## ۹. اسکوپ V1 و وضعیت پروتوتایپ

| قابلیت | V1 | وضعیت در پروتوتایپ (این PR) |
|---|---|---|
| دمای لحظه‌ای و نمودار انحراف | خارج | `feature.telemetry` به‌صورت پیش‌فرض خاموش |
| گواهی زنجیره‌ی سرد (PDF دما) | خارج (به داده‌ی سنسور وابسته است) | لینک‌ها و صفحه پشت همان flag |
| اتصال دماسنج و نشان «سنسور متصل» | خارج | `feature.sensor` خاموش؛ اثر آن در رتبه‌بندی، XP پرو و پیشنهاد راننده هم پشت flag است |
| تماس درون‌برنامه‌ای (VoIP) | خارج | حذف از UI؛ فقط لینک `tel:` پس از بیعانه |
| بارنامه‌ی رسمی دولتی (خودکار) | خارج | فقط بارنامه‌ی داخلی کامیونت + بارگذاری دستی حواله توسط کارکنان (خودکار نیست، در V1 مجاز) |
| مودیان و تسویه‌ی بانکی خودکار | خارج | stub؛ برداشت در V1 با تأیید دستی و ثبت دستی واریز |
| رهگیری GPS از گوشی راننده | داخل | موقعیت شبیه‌سازی‌شده؛ در Laravel واقعی می‌شود |
| بیمه، کد تخفیف، انعام، پرو، تکرارشونده | تصمیم مدیر پروژه | روشن (flag دارند) |

---

## ۱۰. تصمیم‌های باز (باید پیش از اسپرینت Backend بسته شوند)

1. **ترتیب بیعانه و پذیرش.** Spec می‌گوید ابتدا بیعانه، سپس اعلان به رانندگان، سپس پذیرش. پروتوتایپ می‌گوید راننده تأیید می‌کند، سپس صاحب بار ظرف ۱۰ دقیقه بیعانه می‌دهد. مدل پروتوتایپ پول صاحب بار را برای باری که راننده ندارد بلوکه نمی‌کند و با رفتار بازار ایران سازگارتر است، ولی ریسک «راننده‌ی منتظر» دارد (با `deposit.maxMisses` کنترل شده). **پیشنهاد: مدل پروتوتایپ + گزینه‌ی پرداخت خودکار از کیف پول.**
2. **زمان رفع ماسک.** Spec می‌گوید «پس از پذیرش». پروتوتایپ پس از بیعانه رفع ماسک می‌کند که سخت‌گیرانه‌تر است. اگر بند ۱ به نفع پروتوتایپ بسته شود، این بند هم خودبه‌خود همان می‌شود. Spec باید اصلاح شود.
3. **پنجره‌ی اعتراض ۲۴ ساعته واقعاً چیزی را متوقف نمی‌کند.** در موتور فعلی فقط اختلاف نقدی تسویه را hold می‌کند. ثبت شکایت توسط صاحب بار پس از تحویل، آزادسازی درآمد راننده را نگه نمی‌دارد و وضعیت `DISPUTED` هیچ‌جا توسط موتور تنظیم نمی‌شود. باید قاعده تعریف شود: کدام شکایت، با چه مهلتی، تسویه را hold می‌کند.
4. **مدل فاکتور BROKER یا MARKETPLACE** و نرخ مالیات: نیاز به نظر حسابدار و حقوقی (`DECISIONS.md` بند ۸).
5. **راننده با سفر فعال آیا می‌تواند بار دوم (برگشت) را قفل کند؟** موتور فعلی منع نمی‌کند. برای بار برگشت مفید است، ولی ریسک هم‌پوشانی زمانی دارد. پیشنهاد: مجاز فقط اگر `pickup_at` بار دوم بعد از `deliver_by` بار فعلی باشد.
6. **رنگ و سری حروف پلاک خودروی باری** (`DECISIONS.md` بند ۱۲): نیاز به منبع رسمی.

---

## ۱۱. مشکلات شناخته‌شده در پروتوتایپ

- OTP تحویل قابل پیش‌بینی است (بخش ۵.۳).
- OTP ورود ثابت `12345` است (فقط در حالت دمو).
- اعتبارسنجی کد ملی و شبا در حالت تست شل است.
- پوشه‌ی `supabase/` با موتور فعلی هم‌خوان نیست (بخش ۰).
- اسکریپت `npm run e2e` به فایل‌هایی اشاره می‌کرد که وجود نداشتند. در این PR اصلاح شد.
