"use client";

import { Inbox, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar, CrownMark, ProfileHero, ReviewItem } from "@/components/profile";
import { Logo, PortalCue, ProBadge } from "@/components/brand";
import { SensorBadge } from "@/components/driver/vehicleUi";
import { PlateView } from "@/components/graphics/PlateInput";
import { TruckIllustration } from "@/components/graphics/TruckIllustration";
import { CargoIcon, Countdown, RouteLine, StatusBadge, TempChip, RatingPill } from "@/components/molecules";
import { toast } from "@/components/Toaster";
import { Badge, Button, Card, EmptyState, Field, Input, Progress, Segmented, Select, Sheet, Skeleton, Stars, Stat, Stepper, Tabs, Textarea, Toggle } from "@/components/ui";
import { BarList, LineChart, ShareBar, Spark, SERIES } from "@/components/admin/charts";
import { Kpi, Pill } from "@/components/admin/kit";
import { fa, STATUS } from "@/lib/format";
import { VEHICLES, VEHICLE_KINDS } from "@/lib/vehicles";
import { TOKENS } from "@/lib/handoff";
import type { CargoKind, OrderStatus } from "@/lib/types";

/** One specimen: live component + the numbers a designer needs. */
function Spec({ title, spec, children, wide }: { title: string; spec: string[]; children: ReactNode; wide?: boolean }) {
  return (
    <Card className="space-y-4 p-5">
      <div><h3 className="text-lg font-black">{title}</h3><ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-6 text-ink-3">{spec.map((s) => <li key={s}>{s}</li>)}</ul></div>
      <div className={wide ? "" : "flex flex-wrap items-start gap-3"}>{children}</div>
    </Card>
  );
}
const Cap = ({ children }: { children: ReactNode }) => <div className="mb-1.5 mt-1 text-[11px] font-bold text-ink-4">{children}</div>;
const Row = ({ label, children }: { label: string; children: ReactNode }) => <div className="flex flex-wrap items-center gap-3"><span className="w-28 shrink-0 text-xs font-bold text-ink-3">{label}</span><div className="flex flex-wrap items-center gap-3">{children}</div></div>;

const TYPE = [["نمایش (Hero)", "text-5xl / 48px", "900", "۱٫۱", "اعداد بزرگ لندینگ"], ["H1 صفحه", "text-2xl–3xl / 24–30px", "900", "۱٫۲۵", "عنوان صفحه"], ["H2 بخش", "text-lg–xl / 18–20px", "800", "۱٫۴", "عنوان کارت"], ["بدنه", "text-[15px]–base / 15–16px", "500", "۱٫۷ تا ۲", "متن اصلی و فیلد"], ["بدنه‌ی کوچک", "text-sm / 14px", "500", "۲ (leading-7)", "توضیح"], ["برچسب/کمکی", "text-xs / 12px", "700", "۱٫۶", "Badge، hint، زمان"], ["عدد KPI", "26px", "900 + tabular", "۱", "کارت آمار"]];

const SAMPLE_STATUSES = Object.keys(STATUS) as OrderStatus[];
const CARGOS: CargoKind[] = ["dairy", "meat", "fish", "produce", "icecream", "pharma", "dry"];
const SPARK = [3, 5, 4, 7, 6, 9, 8, 11];

export function StyleGuide() {
  const [tab, setTab] = useState("a");
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState("x");
  const [sheet, setSheet] = useState(false);
  const [step, setStep] = useState(1);
  return (
    <div className="space-y-5">
      <Card className="space-y-2 bg-act-soft p-5"><h2 className="text-xl font-black">استایل گاید زنده</h2><p className="text-sm leading-7 text-ink-2">همه‌ی نمونه‌ها کامپوننت واقعی محصول‌اند (نه عکس). هر کدام اندازه، فاصله، حالت‌ها و قواعد را کنار خودش دارد. هر چه را اینجا می‌بینید باید در Figma به‌صورت Component + Variant ساخته شود.</p></Card>

      <Spec wide title="رنگ‌ها" spec={["نام‌گذاری: role-step؛ فقط همین‌ها در UI مجازند", "کنتراست متن روی پس‌زمینه ≥ ۴٫۵:۱", "وضعیت‌ها همیشه با آیکن/متن همراه‌اند"]}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{TOKENS.colors.map(([n, c]) => <div key={n} className="overflow-hidden rounded-ui shadow-soft"><div className="h-14" style={{ background: c }} /><div className="p-2 text-[11px]"><div className="font-bold">{n}</div><div dir="ltr" className="text-start font-mono text-ink-3">{c}</div></div></div>)}</div>
        <Cap>رنگ سری نمودارها (به ترتیب ثابت، هیچ‌وقت چرخشی نیست)</Cap><div className="flex gap-2">{SERIES.map((c) => <span key={c} className="grid h-10 w-20 place-items-center rounded-lg text-[10px] font-bold text-white" style={{ background: c }} dir="ltr">{c}</span>)}</div>
        <Cap>قاعده: گرادیان فقط در تم پرو و تزئین لندینگ مجاز است؛ روی دکمه و کارت عادی ممنوع.</Cap>
      </Spec>

      <Spec wide title="تایپوگرافی" spec={["فونت: Vazirmatn (وزن‌های ۵۰۰ / ۷۰۰ / ۸۰۰ / ۹۰۰)", "اعداد: فارسی، `tabular` برای ستون‌ها", "حداقل متن بدنه ۱۴px؛ برچسب ۱۲px"]}>
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="text-xs text-ink-3">{["سطح", "اندازه", "وزن", "فاصله‌ی خط", "کاربرد"].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead><tbody className="divide-y divide-line/70">{TYPE.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`p-2 ${i === 0 ? "font-bold" : "text-ink-2"}`}>{c}</td>)}</tr>)}</tbody></table></div>
        <div className="mt-3 space-y-1"><div className="text-3xl font-black">حمل بار یخچالی، ساده و شفاف</div><div className="text-xl font-extrabold">عنوان بخش — کرج ← قم</div><p className="text-[15px] leading-8 text-ink-2">متن بدنه: بار شما پس از پرداخت بیعانه برای راننده‌ی تأییدشده رزرو می‌شود و آدرس دقیق باز می‌شود.</p><p className="text-xs text-ink-3">متن کمکی: ۱۲ شهریور ۱۴۰۵، ۱۲:۴۰</p></div>
      </Spec>

      <Spec wide title="فاصله، گوشه، سایه، لایه، حرکت" spec={["پایه‌ی فاصله ۴px؛ مقیاس: ۴·۸·۱۲·۱۶·۲۰·۲۴·۳۲", "همه‌ی گوشه‌ها یک توکن: radius-ui = ۱۸px (چیپ/آواتار = کامل)"]}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-ui bg-surface-2 p-4 text-sm leading-7"><b>فاصله</b><br />padding کارت: ۱۶ (موبایل) / ۲۰ (دسکتاپ) · فاصله‌ی عمودی بین کارت‌ها: ۱۶ · فاصله‌ی آیکن و متن: ۸ · padding صفحه: ۱۶ موبایل / ۳۲ دسکتاپ · عرض محتوا: صاحب بار ۱۰۲۴ · راننده ۶۷۲ · ادمین ۱۵۰۰ · متن بلاگ ۷۲۰</div>
          <div className="rounded-ui bg-surface-2 p-4 text-sm leading-7"><b>لایه (z-index)</b><br />هدر ۳۰ · ویجت پشتیبانی/دمو ۴۰ · Sheet و منوی موبایل ۵۰ · جست‌وجوی سریع ۶۰ · Toast بالاتر از همه<br /><b>حرکت</b><br />pop ۲۶۰ms · rise ۳۲۰ms · fade ۲۰۰ms · shimmer ۱٫۴s · reduced-motion = بدون انیمیشن</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4"><div className="grid h-20 w-36 place-items-center rounded-ui bg-white text-xs shadow-soft">shadow-soft</div><div className="grid h-20 w-36 place-items-center rounded-ui bg-white text-xs shadow-lift">shadow-lift</div><div className="grid h-20 w-36 place-items-center rounded-full bg-brand-500 text-xs font-bold">radius کامل</div></div>
      </Spec>

      <Spec title="دکمه‌ها" spec={["ارتفاع: sm ۴۴ · md ۴۸ · lg ۵۶ (هدف لمسی ≥ ۴۴)", "padding افقی ۱۶/۲۰/۲۴ · گوشه ۱۸ · gap آیکن ۸", "حالت‌ها: default, hover, pressed (scale ۰٫۹۷), focus-visible (حلقه‌ی ۴px), disabled (۵۰٪), loading", "یک دکمه‌ی primary در هر ناحیه؛ بدون گرادیان"]} wide>
        <div className="space-y-3">
          {(["primary", "accent", "secondary", "ghost", "danger"] as const).map((v) => <Row key={v} label={v}><Button variant={v} size="sm">کوچک</Button><Button variant={v}>متوسط</Button><Button variant={v} size="lg">بزرگ</Button><Button variant={v} disabled>غیرفعال</Button><Button variant={v} loading>در حال ثبت</Button></Row>)}
          <Row label="block"><div className="w-72"><Button block size="lg">پرداخت بیعانه · ۱٬۲۰۰٬۰۰۰ تومان</Button></div></Row>
        </div>
      </Spec>

      <Spec title="فیلدهای فرم" spec={["ارتفاع ۴۸ · گوشه ۱۸ · padding افقی ۱۶ · متن ۱۵px", "برچسب بالای فیلد همیشه دیده شود؛ راهنما زیر فیلد؛ خطا زیر فیلد با رنگ و متن", "حالت‌ها: خالی، پر، focus (حلقه آبی)، خطا، غیرفعال"]} wide>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="نام گیرنده" hint="همان که روی پلاک انبار است">{(id) => <Input id={id} placeholder="مثلاً علی رضایی" />}</Field>
          <Field label="موبایل گیرنده" error="شماره‌ی موبایل را با ۰۹ و ۱۱ رقم وارد کنید.">{(id) => <Input id={id} defaultValue="0912" dir="ltr" aria-invalid />}</Field>
          <Field label="غیرفعال">{(id) => <Input id={id} disabled defaultValue="قابل ویرایش نیست" />}</Field>
          <Field label="لیست کشویی">{(id) => <Select id={id}><option>نیسان یخچال‌دار</option><option>کامیونت</option></Select>}</Field>
          <div className="md:col-span-2"><Field label="توضیحات (چندخطی)">{(id) => <Textarea id={id} placeholder="هر نکته‌ای برای راننده…" />}</Field></div>
        </div>
      </Spec>

      <Spec title="کنترل‌های انتخاب" spec={["Toggle: ۴۴px هدف لمسی؛ Segmented: گرید مساوی؛ Tabs: pill با شمارنده", "حالت‌ها: on/off، فوکوس، غیرفعال"]} wide>
        <div className="space-y-3">
          <Row label="Toggle"><Toggle label="پرداخت خودکار بیعانه" checked={on} onChange={setOn} /><Toggle label="غیرفعال" checked={false} disabled /></Row>
          <Row label="Segmented"><div className="w-80"><Segmented value={seg} onChange={setSeg} options={[{ value: "x", label: "استاندارد" }, { value: "y", label: "پرو", sub: "+۱۵٪" }]} /></div></Row>
          <Row label="Tabs"><Tabs value={tab} onChange={setTab} tabs={[{ id: "a", label: "فعال", count: 4 }, { id: "b", label: "در انتظار" }, { id: "c", label: "تکمیل‌شده", count: 12 }]} /></Row>
          <Row label="Stepper"><div className="w-full max-w-lg"><Stepper steps={["مسیر", "بار", "سرویس", "قیمت", "بازبینی"]} current={step} /><div className="mt-2 flex gap-2"><Button size="sm" variant="secondary" onClick={() => setStep(Math.max(0, step - 1))}>قبلی</Button><Button size="sm" onClick={() => setStep(Math.min(4, step + 1))}>بعدی</Button></div></div></Row>
        </div>
      </Spec>

      <Spec title="برچسب‌ها و وضعیت‌ها" spec={["Badge: ارتفاع ~۲۴، متن ۱۲px/۷۰۰، حلقه‌ی ۱px هم‌رنگ", "تُن‌ها: ok · warn · danger · info · neutral · brand", "هر ۱۷ وضعیت سفارش با StatusBadge و متن فارسی ثابت"]} wide>
        <div className="space-y-3"><Row label="Badge">{(["ok", "warn", "danger", "info", "neutral", "brand"] as const).map((t) => <Badge key={t} tone={t}>{t}</Badge>)}<Badge tone="ok" dot>با نقطه</Badge></Row>
          <Row label="Pill (ادمین)">{(["ok", "warn", "danger", "info", "neutral"] as const).map((t) => <Pill key={t} tone={t}>{t}</Pill>)}</Row>
          <Row label="پرو/سنسور"><ProBadge /><SensorBadge /></Row>
          <div><Cap>وضعیت‌های سفارش</Cap><div className="flex flex-wrap gap-2">{SAMPLE_STATUSES.map((s) => <StatusBadge key={s} status={s} />)}</div></div></div>
      </Spec>

      <Spec title="کارت، آمار و KPI" spec={["Card: سفید، سایه‌ی soft، گوشه ۱۸، padding ۱۶–۲۰", "Stat (کاربر): عدد ۲۶px/۹۰۰؛ Kpi (ادمین): همان + اسپارک", "Hover کارت‌های لینک‌دار: سایه‌ی lift"]} wide>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="سفارش فعال" value={fa(3)} sub="۲ در مسیر" /><Stat label="موجودی کیف پول" value="۱٬۲۰۰٬۰۰۰" sub="تومان" tone="accent" /><Kpi label="سفارش‌ها (۳۰ روز)" value={fa(135)} spark={<Spark values={SPARK} />} /><Kpi label="درآمد پلتفرم" value="۳٫۲ میلیارد تومان" tone="ok" sub="تجمعی" /></div>
      </Spec>

      <Spec title="نشانگرها" spec={["Progress: ارتفاع ۸، گوشه کامل، انیمیشن ۵۰۰ms", "Stars: ۲۸px (قابل‌ورود) / ۱۴px (نمایشی)", "Countdown: نوار + عدد؛ رنگ هشدار در ۲۰٪ پایانی"]} wide>
        <div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Cap>Progress</Cap><Progress value={25} /><Progress value={60} tone="warn" /><Progress value={95} tone="danger" /></div><div className="space-y-2"><Cap>Stars</Cap><Stars value={4} /><Stars value={0} onChange={() => undefined} /><RatingPill r={{ avg: 4.6, count: 120 }} /></div><div><Cap>Countdown</Cap><Countdown until={Date.now() + 8 * 60_000} total={600} /></div></div>
      </Spec>

      <Spec title="حالت خالی، بارگذاری، خطا و بازخورد" spec={["Loading: اسکلت هم‌اندازه‌ی محتوا (پرش ندارد)", "Empty: آیکن + عنوان + یک جمله + دکمه‌ی عمل", "Toast: بالای صفحه، ۴ ثانیه، رنگ بر اساس نتیجه؛ خطای فرم زیر فیلد", "Alert داخل صفحه: نوار رنگی با آیکن"]} wide>
        <div className="grid gap-4 md:grid-cols-2"><Card className="space-y-2 p-4"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-24" /><Skeleton className="h-10 w-1/2" /></Card><Card><EmptyState icon={<Inbox className="size-8" />} title="هنوز سفارشی ندارید" body="اولین سفارش را ثبت کنید و قیمت را همان لحظه ببینید." action={<Button>ثبت سفارش</Button>} /></Card></div>
        <div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => toast("سفارش ثبت شد.")}>Toast موفق</Button><Button variant="secondary" onClick={() => toast("پرداخت انجام نشد. دوباره تلاش کنید.", "err")}>Toast خطا</Button><Button variant="secondary" onClick={() => toast("درخواست در صف ارسال است.", "info")}>Toast اطلاعاتی</Button></div>
        <div className="mt-3 space-y-2"><div role="alert" className="rounded-ui bg-danger-bg p-3 text-sm font-medium text-danger">خطا: کد ملی معتبر نیست؛ ۱۰ رقم را دوباره بررسی کنید.</div><div role="status" className="rounded-ui bg-warn-bg p-3 text-sm font-bold text-warn">هشدار: مدارک شما در حال بررسی است.</div><div role="status" className="rounded-ui bg-ok-bg p-3 text-sm font-bold text-ok">موفق: مدارک تأیید شد.</div></div>
      </Spec>

      <Spec title="Sheet (پنجره‌ی شناور)" spec={["موبایل: ته‌صفحه، حداکثر ارتفاع ۹۰٪، گوشه‌ی بالا ۲۸", "دسکتاپ: کشو از لبه، عرض ۴۸۰ (wide ۷۲۰)", "ساختار: عنوان + ✕ (۴۴px) · بدنه‌ی اسکرول‌شونده · فوتر چسبان با اقدام اصلی", "رفتار: قفل اسکرول پس‌زمینه، Esc و کلیک بیرون = بستن، فوکوس درون Sheet"]}>
        <Button onClick={() => setSheet(true)}>باز کردن نمونه</Button>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="پرداخت بیعانه" footer={<Button block size="lg" onClick={() => setSheet(false)}>پرداخت · ۱٬۲۰۰٬۰۰۰ تومان</Button>}><div className="space-y-3 text-sm leading-7"><p>مبلغ بیعانه ۱۰٪ کرایه است. پس از پرداخت، آدرس دقیق و مشخصات راننده باز می‌شود.</p><Segmented value="w" onChange={() => undefined} options={[{ value: "w", label: "کیف پول" }, { value: "c", label: "کارت" }]} /></div></Sheet>
      </Spec>

      <Spec title="آواتار، تاج پرو و پروفایل" spec={["Avatar: ۴۰/۴۸/۸۴؛ رنگ از hue ثابت هر کاربر؛ پرو: تاج + حلقه‌ی طلایی", "ProfileHero: کاور ۹۶–۱۲۸ تخت (نه گرادیان)، آواتار نیمه‌روی کاور، نام زیر آواتار", "تم پرو: سرمه‌ای + طلایی؛ تاج بالای آواتار"]} wide>
        <div className="mb-4 flex items-end gap-4"><Avatar name="علی رضایی" size={40} /><Avatar name="علی رضایی" size={48} hue={30} /><Avatar name="مجتبی سلیمانی" pro size={84} hue={260} /><CrownMark className="h-8 w-12" /></div>
        <div className="grid gap-4 md:grid-cols-2"><ProfileHero name="محمدرضا کریمی" headline="کامیون ۱۰ تن · عضو از ۱۴ ماه پیش" hue={300} verified rating={4.4} ratingCount={13} badges={<Badge tone="ok">مدارک تأییدشده</Badge>} stats={[{ label: "سفر", value: "۲۰" }, { label: "وقت‌شناسی", value: "۸۸٪" }, { label: "نظافت", value: "۹۰" }]} /><ProfileHero name="مجتبی سلیمانی" headline="ولوو FL · مدل ۱۳۹۳" hue={220} pro verified rating={4.6} ratingCount={60} badges={<><ProBadge /><SensorBadge /></>} stats={[{ label: "سفر", value: "۹۸" }, { label: "وقت‌شناسی", value: "۸۷٪" }, { label: "لغو", value: "۰٪" }]} /></div>
        <div className="mt-3"><ReviewItem name="پیمان طاهری" rating={5} text="به‌موقع رسید و دما کاملاً ثابت بود." at="۲۲ مرداد" /></div>
      </Spec>

      <Spec title="کامپوننت‌های دامنه‌ای" spec={["RouteLine: مبدأ ← مقصد با نقطه‌ی رنگی (مبدأ زرد، مقصد آبی)", "TempChip: ۳ رده‌ی منجمد/سردخانه‌ای/خنک با آیکن؛ دما با علامت درجه و منفی درست", "CargoIcon: ۷ نوع بار، ۱۶px", "PlateView: پلاک ایرانی استاندارد (دو رقم، حرف، سه رقم، ایران + کد)"]} wide>
        <div className="grid gap-4 md:grid-cols-2"><div className="space-y-3"><RouteLine from="کرج" to="قم" sub={["مهرشهر", "شکوهیه"]} /><div className="flex flex-wrap gap-2"><TempChip min={-25} max={-18} /><TempChip min={0} max={4} /><TempChip min={8} max={15} /></div><div className="flex flex-wrap gap-3">{CARGOS.map((c) => <span key={c} className="inline-flex items-center gap-1 text-xs"><CargoIcon type={c} />{c}</span>)}</div></div><div className="flex flex-col items-start gap-3"><PlateView plate={{ two: "۱۲", letter: "ب", three: "۳۴۵", prov: "۶۸", variant: "commercial" }} /><div className="flex items-center gap-3"><Logo /><PortalCue label="اپ راننده" tone="driver" /><PortalCue label="پنل صاحب بار" tone="shipper" /><PortalCue label="مدیریت" tone="admin" /></div></div></div>
      </Spec>

      <Spec title="تصاویر خودرو" spec={["۸ نوع، رنگ‌پذیر (نقش‌های رنگی)، ۴ حالت: idle / driving / cooling / alert", "اندازه‌های استفاده: h-10 (کارت) · h-14 (انتخاب نوع) · h-24 (پروفایل) · h-20 تمام‌عرض (جزئیات)", "منبع: Noto Emoji (Apache-2.0) — ذکر منبع الزامی"]} wide>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{VEHICLE_KINDS.map((k) => <div key={k} className="rounded-ui bg-surface-2 p-3 text-center"><TruckIllustration kind={k} className="mx-auto h-16 w-full" /><div className="mt-1 text-xs font-bold">{VEHICLES[k].short}</div></div>)}</div>
        <div className="mt-3 flex flex-wrap gap-4">{(["idle", "driving", "cooling", "alert"] as const).map((s) => <div key={s} className="text-center text-xs"><TruckIllustration kind="truck10" state={s} className="h-16 w-28" />{s}</div>)}</div>
      </Spec>

      <Spec title="نمودارها" spec={["رنگ سری از SERIES؛ خط ۲px؛ شبکه کم‌رنگ؛ tooltip و crosshair روی hover", "برای ≥۲ سری legend الزامی است؛ نمودار دوم‌محوره ممنوع"]} wide>
        <div className="grid gap-4 md:grid-cols-2"><Card className="p-4"><LineChart series={[{ name: "ثبت‌شده", points: SPARK.map((y, x) => ({ x, y })) }, { name: "تحویل‌شده", points: SPARK.map((y, x) => ({ x, y: Math.max(0, y - 2) })) }]} xLabel={(x) => fa(Math.round(x))} /></Card><Card className="space-y-4 p-4"><ShareBar parts={[{ label: "تکمیل‌شده", value: 60, color: SERIES[0] }, { label: "در مسیر", value: 25, color: SERIES[1] }, { label: "لغو", value: 15, color: SERIES[2] }]} /><BarList rows={[{ label: "کرج ← قم", value: 12 }, { label: "تهران ← اصفهان", value: 9 }, { label: "شیراز ← اهواز", value: 5 }]} /></Card></div>
      </Spec>

      <Spec title="جدول داده‌ی ادمین" spec={["ردیف ۴۴px · هدر چسبان · ستون‌ها قابل انتخاب · ۲۵ ردیف در صفحه", "ابزار: جستجو، فیلتر، مرتب‌سازی، نمای ذخیره‌شده، انتخاب گروهی، خروجی CSV/Excel", "موبایل: اسکرول افقی داخل کارت"]} wide>
        <Card className="overflow-x-auto p-0"><div className="flex items-center gap-2 border-b border-line p-3"><Search className="size-4 text-ink-3" aria-hidden /><span className="text-sm text-ink-3">جستجو…</span></div><table className="w-full min-w-[520px] text-sm"><thead><tr className="bg-surface-2 text-xs text-ink-3"><th className="p-3 text-start">سفارش</th><th className="p-3 text-start">مسیر</th><th className="p-3 text-start">وضعیت</th><th className="p-3 text-end">کرایه</th></tr></thead><tbody className="divide-y divide-line/70">{[["o-x11", "کرج ← قم", "ASSIGNED", "۵٬۰۰۰٬۰۰۰"], ["o-x12", "تبریز ← ارومیه", "OPEN", "۴٬۲۰۰٬۰۰۰"], ["o-x13", "شیراز ← اهواز", "COMPLETED", "۹٬۸۰۰٬۰۰۰"]].map((r) => <tr key={r[0]} className="h-11 hover:bg-surface-2"><td className="p-3 font-mono text-xs">{r[0]}</td><td className="p-3 font-bold">{r[1]}</td><td className="p-3"><StatusBadge status={r[2] as OrderStatus} /></td><td className="tabular p-3 text-end">{r[3]} تومان</td></tr>)}</tbody></table></Card>
      </Spec>

      <Spec title="آیکن‌ها" spec={["lucide-react؛ اندازه‌ها: ۱۶ (inline) · ۲۰ (دکمه/نوار) · ۲۴ (عنوان) · ۳۲ (حالت خالی)", "ضخامت خط ۲؛ رنگ از متن مجاور؛ آیکن تزئینی `aria-hidden`؛ آیکن‌تنها همیشه aria-label", "ایموجی ممنوع"]} wide>
        <div className="flex items-center gap-6 text-ink-2"><Search className="size-4" aria-hidden /><Search className="size-5" aria-hidden /><Search className="size-6" aria-hidden /><Search className="size-8" aria-hidden /></div>
      </Spec>
    </div>
  );
}
