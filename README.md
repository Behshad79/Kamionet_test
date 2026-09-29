# کامیونت (Kamionet) — پروتوتایپ

پلتفرم حمل بار یخچال‌دار (زنجیره‌ی سرد) در ایران. Next.js (App Router) + TypeScript + Tailwind v4، کاملاً RTL با فونت وزیرمتن (self-hosted).

## اجرا

```bash
npm i
npm run dev            # http://localhost:3000
npm run build          # خروجی استاتیک در out/
```

## نکات پروتوتایپ

- **بدون بک‌اند:** «سرور» در `src/lib/store.ts` شبیه‌سازی شده و روی `localStorage` می‌نشیند. هر اکشن اتمیک است (خواندن مجدد ← تغییر ← نوشتن) و تب‌ها با رویداد `storage` مثل Realtime همگام می‌شوند. برای دیدن رقابت واقعی دو راننده، اپ را در دو تب باز کنید (نشست هر تب جدا است).
- **OTP:** همیشه `12345`. ادمین: شماره‌ی `09120000000`.
- **ماسک اطلاعات:** UI فقط `OrderView` می‌گیرد (`src/lib/mask.ts`): مهمان ← فقط شهر و بازه قیمت، راننده ← محدوده‌ی تقریبی، طرفین پس از ASSIGNED ← جزئیات کامل.
- **تطبیق دما:** `vehicle.minTemp <= order.tempMax` (`src/lib/matching.ts`).
- **نقشه:** Leaflet؛ پیش‌فرض OpenStreetMap و محدود به مرزهای ایران. برای نقشه‌ی فارسی (نشان / Map.ir) هنگام بیلد `NEXT_PUBLIC_TILE_URL` و `NEXT_PUBLIC_TILE_ATTRIBUTION` را تنظیم کنید (نیازمند کلید API خودتان). خوشه‌بندی، حالت loading و خطای نقشه در `src/components/KMap.tsx` است.
- **نرخ مرجع:** `src/lib/pricing.ts` (`suggestRate`) پشت یک تابع واحد است تا بعداً با نرخ محاسبه‌شده جایگزین شود.
- مسیر به Postgres: `claimOrder` ← تابع SQL با `SELECT … FOR UPDATE SKIP LOCKED`؛ ماسک ← View/RPC؛ بازگشت قفل ← `pg_cron`.

## استقرار

Workflow آماده‌ی GitHub Pages در `.github/workflows/pages.yml` است (روی push به `main` یا اجرای دستی). در تنظیمات ریپو: Settings → Pages → Source = GitHub Actions.

## بک‌اند واقعی (Supabase / Postgres)

`supabase/migrations` معادل واقعی «سرور شبیه‌سازی‌شده» است:

- جدول `orders` (اطلاعات عمومی + مختصات **تقریبی** که سمت سرور ساخته می‌شود) جدا از `order_private` (نشانی و مختصات دقیق) است؛ RLS فقط به صاحب بار، یا راننده‌ی **پس از ASSIGNED**، اجازه‌ی خواندن دومی را می‌دهد.
- تغییر وضعیت فقط از طریق RPCهای `claim_order`، `confirm_assign`، `start_trip`، `deliver_order`، `cancel_order` (بدون policy برای UPDATE مستقیم).
- `claim_order` با `SELECT … FOR UPDATE SKIP LOCKED`: همزمان دو راننده ← یکی برنده، دیگری فوراً `ALREADY_TAKEN` (بدون انتظار).
- قیدهای `driver_id <> shipper_id` و تطبیق دما (`min_temp_capacity <= required_temp_max`) در خود دیتابیس اعمال می‌شود.
- `reap_locks()` باید با pg_cron هر ۱۰ ثانیه اجرا شود: `select cron.schedule('reap','10 seconds','select reap_locks()')`.
- تست: `bash supabase/tests/run.sh` (یک Postgres موقت می‌سازد؛ ۱۷ سناریو + تست رقابت همزمان).

هنوز وصل نشده: جایگزینی `store.ts` با کلاینت Supabase، Realtime روی `orders`، Storage برای عکس‌ها، احراز OTP (کاوه‌نگار).

## تست

```bash
npm run build && npx serve out -l 4173 &     # سپس:
CHROMIUM_PATH=/path/to/chrome npm run e2e     # مرورگر واقعی: بازار، ویزارد، تله‌متری، ممیزی UX
npm run test:db                               # Postgres: RLS، قفل، تطبیق خودرو، رقابت همزمان
```
