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
- **نقشه:** Leaflet + OpenStreetMap؛ منبع کاشی فقط در `src/components/KMap.tsx` است و برای نشان/بلد باید همان‌جا عوض شود.
- **نرخ مرجع:** `src/lib/pricing.ts` (`suggestRate`) پشت یک تابع واحد است تا بعداً با نرخ محاسبه‌شده جایگزین شود.
- مسیر به Postgres: `claimOrder` ← تابع SQL با `SELECT … FOR UPDATE SKIP LOCKED`؛ ماسک ← View/RPC؛ بازگشت قفل ← `pg_cron`.

## استقرار

Workflow آماده‌ی GitHub Pages در `.github/workflows/pages.yml` است (روی push به `main` یا اجرای دستی). در تنظیمات ریپو: Settings → Pages → Source = GitHub Actions.
