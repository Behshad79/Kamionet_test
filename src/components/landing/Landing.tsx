"use client";

import { BadgeCheck, ChevronDown, Clock, Crown, FileCheck2, Handshake, MapPinned, Menu, ShieldCheck, Star, Thermometer, Truck, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fa, STATUS, toman } from "@/lib/format";
import { useBoot } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { VEHICLES } from "@/lib/vehicles";
import type { VehicleKind } from "@/lib/types";
import { IranMap } from "../graphics/IranMap";
import { TruckIllustration } from "../graphics/TruckIllustration";
import { InsurerLogo, Logo, ProBadge } from "../brand";
import { CargoIcon, RouteLine, TempChip } from "../molecules";
import { ButtonLink, Skeleton, cx } from "../ui";
import { DemoDrawer } from "../portal/DemoDrawer";
import { CARGO } from "@/lib/format";

const NAV = [
  { href: "#how", label: "چطور کار می‌کند" },
  { href: "#features", label: "امکانات" },
  { href: "#pro", label: "کامیونت پرو" },
  { href: "#fleet", label: "ناوگان" },
  { href: "#faq", label: "سؤالات پرتکرار" },
];

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-full px-3 ps-5 shadow-soft ring-1 ring-white/70">
        <Link href="/" aria-label="کامیونت"><Logo /></Link>
        <nav aria-label="ناوبری اصلی" className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => <a key={n.href} href={n.href} className="flex h-10 items-center rounded-full px-4 text-sm font-bold text-ink-2 transition hover:bg-ink/5">{n.label}</a>)}
        </nav>
        <div className="flex items-center gap-1.5">
          <ButtonLink href="/login/" variant="ghost" size="sm" className="max-sm:hidden! rounded-full!">ورود</ButtonLink>
          <ButtonLink href="/app/login/" size="sm" className="rounded-full!">ثبت بار</ButtonLink>
          <button className="grid size-11 place-items-center rounded-full hover:bg-ink/5 lg:hidden" aria-label={open ? "بستن منو" : "باز کردن منو"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
        </div>
      </div>
      {open && (
        <nav aria-label="منوی موبایل" className="glass mx-auto mt-2 grid max-w-6xl animate-rise gap-1 rounded-3xl p-3 shadow-lift lg:hidden">
          {NAV.map((n) => <a key={n.href} onClick={() => setOpen(false)} href={n.href} className="flex h-12 items-center rounded-2xl px-4 font-bold hover:bg-ink/5">{n.label}</a>)}
          <Link href="/login/" className="flex h-12 items-center rounded-2xl px-4 font-extrabold text-accent-600">ورود به حساب</Link>
        </nav>
      )}
    </header>
  );
}

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => { const k = Math.min(1, (t - t0) / 1100); setV(Math.round(to * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref} className="tabular">{fa(v)}{suffix}</span>;
}

function Hero() {
  const s = useStore();
  const live = s.ready ? s.orders.filter((o) => o.status === "IN_TRANSIT").length : 0;
  return (
    <section className="mesh relative -mt-[68px] overflow-hidden pt-[68px]">
      <div className="blob pointer-events-none absolute -start-24 top-40 size-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden />
      <div className="blob pointer-events-none absolute -end-20 top-10 size-80 rounded-full bg-accent-500/20 blur-3xl [animation-delay:-4s]" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
        <div className="space-y-7">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-extrabold text-accent-700 shadow-soft ring-1 ring-white/70"><span className="relative flex size-2"><span className="live-ring absolute inset-0 rounded-full bg-ok" /><span className="relative size-2 rounded-full bg-ok" /></span>مخصوص زنجیره‌ی سرد ایران</span>
          <h1 className="text-balance text-[40px] font-black leading-[1.2] tracking-tight lg:text-[58px]">بار یخچالی‌تان را به <span className="text-grad">کامیونِ مناسب</span> بسپارید</h1>
          <p className="max-w-xl text-lg leading-8 text-ink-2">مستقیم، شفاف، بیمه‌شده. قیمت را خودتان می‌گذارید، دمای بار را لحظه‌به‌لحظه می‌بینید و پول تا تحویل سالم نزد کامیونت امانت می‌ماند.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/app/login/" size="lg" className="rounded-full! px-8!">ثبت بار</ButtonLink>
            <ButtonLink href="/driver/login/" size="lg" variant="secondary" className="rounded-full! px-7!"><Truck className="size-5" aria-hidden />راننده هستم</ButtonLink>
          </div>
          <ul className="flex flex-wrap gap-2 text-sm font-bold text-ink-2">
            {["پرداخت امانی تا تحویل", "ثبت و گزارش دما", "بیمه‌ی محموله", "تحویل با کد گیرنده"].map((x) => <li key={x} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ring-white/70"><BadgeCheck className="size-4 text-ok" aria-hidden />{x}</li>)}
          </ul>
        </div>
        <div className="relative">
          <div className="glass rounded-[32px] p-3 shadow-lift ring-1 ring-white/80"><IranMap className="float-y mx-auto w-full max-w-xl" /></div>
          <div className="glass absolute -bottom-5 start-4 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lift ring-1 ring-white/80 max-sm:scale-90">
            <span className="grid size-10 place-items-center rounded-xl bg-ok-bg text-ok"><Thermometer className="size-5" aria-hidden /></span>
            <div><div className="text-[11px] font-bold text-ink-3">در حال حمل همین الان</div><div className="text-xl font-black tabular">{s.ready ? fa(live) : "—"} <span className="text-sm font-bold text-ink-3">کامیون یخچال‌دار</span></div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const s = useStore();
  const done = s.orders.filter((o) => o.status === "COMPLETED").length;
  const cities = new Set(s.orders.flatMap((o) => [o.origin.city, o.dest.city])).size;
  const items = [
    { n: done, label: "سفر تکمیل‌شده", suffix: "+" },
    { n: s.drivers.filter((d) => d.kyc.status === "verified").length, label: "راننده‌ی تأییدشده", suffix: "" },
    { n: s.shippers.length, label: "صاحب بار فعال", suffix: "" },
    { n: cities, label: "شهر تحت پوشش", suffix: "" },
  ];
  return (
    <section aria-label="آمار" className="relative z-10 mx-auto -mt-2 max-w-6xl px-4">
      <div className="glass grid grid-cols-2 gap-px overflow-hidden rounded-[28px] shadow-lift ring-1 ring-white/80 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="bg-white/60 p-6 text-center">
            <div className="text-4xl font-black text-grad">{s.ready ? <CountUp to={i.n} suffix={i.suffix} /> : "—"}</div>
            <div className="mt-1 text-sm font-bold text-ink-3">{i.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-ink-3">آمار بر پایه‌ی داده‌ی نمایشی این نسخه است.</p>
    </section>
  );
}

const STEPS = {
  shipper: [
    { t: "بار را ثبت کنید", d: "مبدأ، مقصد، دما و وزن را وارد کنید؛ قیمت پیشنهادی بازار را می‌بینید و کرایه را خودتان می‌گذارید.", i: MapPinned },
    { t: "راننده‌ی تأییدشده انتخاب می‌کند", d: "رانندگان احراز‌شده بار را برمی‌دارند؛ یا راننده‌ی پرو را مستقیم انتخاب کنید.", i: Truck },
    { t: "بیعانه بپردازید", d: "با پرداخت بیعانه، آدرس دقیق و مشخصات راننده باز و بارنامه صادر می‌شود.", i: Wallet },
    { t: "زنده رهگیری کنید", d: "مسیر و دمای بار را ببینید؛ گیرنده با کد یک‌بارمصرف تحویل می‌گیرد.", i: Thermometer },
  ],
  driver: [
    { t: "ثبت‌نام و احراز", d: "مدارک و خودرو را یک‌بار ثبت کنید؛ بررسی سریع است و هر زمان می‌توانید ادامه دهید.", i: FileCheck2 },
    { t: "بار مناسب مسیرتان را انتخاب کنید", d: "فقط بارهایی که با خودروی شما می‌خواند نمایش داده می‌شود؛ مسیر برگشت هم اعلام کنید.", i: Truck },
    { t: "سفر و ثبت مدارک", d: "عکس بار و فاکتور را ثبت کنید و در مقصد با کد گیرنده تحویل دهید.", i: Clock },
    { t: "درآمد و برداشت", d: "پس از تحویل، درآمد در کیف پول شما می‌نشیند و به شبای خودتان برداشت می‌شود.", i: Wallet },
  ],
};

function HowItWorks() {
  const [tab, setTab] = useState<"shipper" | "driver">("shipper");
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
      <h2 className="text-center text-3xl font-black">چطور کار می‌کند؟</h2>
      <div role="tablist" aria-label="نقش" className="mx-auto mt-6 grid max-w-sm grid-cols-2 rounded-full bg-surface-3 p-1 text-sm font-bold">
        {(["shipper", "driver"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("h-11 rounded-full transition", tab === k ? "bg-white shadow-soft" : "text-ink-3")}>{k === "shipper" ? "صاحب بار" : "راننده"}</button>
        ))}
      </div>
      <ol key={tab} className="mt-8 grid gap-4 md:grid-cols-4">
        {STEPS[tab].map((s, i) => (
          <li key={s.t} className="card-lift animate-rise rounded-[24px] bg-white p-5 shadow-soft" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="mb-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-act-soft text-act-ink"><s.i className="size-5" aria-hidden /></span><span className="text-sm font-black text-ink-3">{fa(i + 1)}</span></div>
            <h3 className="font-extrabold">{s.t}</h3>
            <p className="mt-1.5 text-sm leading-7 text-ink-3">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FEATURES = [
  { i: Thermometer, t: "دمای زنده و گزارش انحراف", d: "نمودار دما در تمام مسیر ثبت می‌شود و هر خروج از بازه با ساعت و شدت مشخص است." },
  { i: ShieldCheck, t: "بیمه‌ی محموله", d: "از میان طرح‌های پایه تا جامع بر پایه‌ی ارزش اعلامی بار انتخاب کنید." },
  { i: Wallet, t: "پرداخت امانی", d: "بیعانه و مابقی نزد کامیونت می‌ماند و پس از تحویل با کد گیرنده آزاد می‌شود." },
  { i: Handshake, t: "ارزیابی دوطرفه و کور", d: "هر دو طرف نظر می‌دهند و نظرها هم‌زمان آشکار می‌شوند؛ بدون سوگیری." },
  { i: MapPinned, t: "رهگیری برای گیرنده", d: "پیوند اختصاصی بدون نیاز به نصب برنامه؛ مسیر، دما و کد تحویل." },
  { i: FileCheck2, t: "بارنامه و گواهی زنجیره‌ی سرد", d: "بارنامه‌ی نسخه‌دار و گواهی PDF دما پس از هر سفر." },
];

function Features() {
  const span = ["lg:col-span-2", "", "", "lg:col-span-2", "", ""];
  const tone = ["from-accent-50", "from-brand-50", "from-ok-bg", "from-brand-50", "from-accent-50", "from-surface-3"];
  return (
    <section id="features" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl font-black tracking-tight lg:text-4xl">هر چه برای حمل مطمئن لازم است</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink-3">از لحظه‌ی ثبت تا تحویل با کد گیرنده، همه‌چیز شفاف و ثبت‌شده است.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div key={f.t} className={cx("card-lift relative overflow-hidden rounded-[28px] bg-gradient-to-br to-white p-6 shadow-soft", tone[i], span[i])}>
              <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-white text-accent-600 shadow-soft"><f.i className="size-6" aria-hidden /></span>
              <h3 className="text-lg font-black">{f.t}</h3>
              <p className="mt-2 text-sm leading-7 text-ink-3">{f.d}</p>
              <f.i className="pointer-events-none absolute -bottom-6 -end-6 size-32 text-ink/[0.035]" aria-hidden />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PRO_ROWS: [string, string, string][] = [
  ["دسترسی به بارها", "بازار عمومی", "استخر اختصاصی پرو + درخواست مستقیم"],
  ["اولویت در تخصیص", "—", "تخصیص هوشمند و درخواست مستقیم صاحب بار"],
  ["بازرسی خودرو", "—", "بازرسی دوره‌ای و نشان تأییدشده"],
  ["پرداخت درآمد", "پس از پنجره‌ی اعتراض", "برداشت فوری (با کارمزد پیکربندی‌شده)"],
  ["کارمزد", "استاندارد", "نرخ ترجیحی"],
];

function ProSection() {
  return (
    <section id="pro" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
      <div className="pro-card overflow-hidden p-6 md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <ProBadge label="کامیونت پرو" />
            <h2 className="mt-4 text-3xl font-black leading-snug">برای بارهای حساس، رانندگانِ بازرسی‌شده</h2>
            <p className="mt-3 leading-8 text-white/80">رانندگان پرو معیارهای سخت‌گیرانه‌ی سابقه، دما و نظافت را پاس کرده‌اند. صاحب بار می‌تواند بار را فقط در استخر پرو منتشر کند یا مستقیم از یک راننده‌ی پرو بخواهد.</p>
            <ButtonLink href="/app/login/" className="mt-5 bg-pro-gold! text-pro-navy! hover:opacity-90">ثبت بار با سرویس پرو</ButtonLink>
          </div>
          <div className="overflow-x-auto rounded-ui bg-white/10 p-1">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">مقایسه‌ی راننده‌ی استاندارد و پرو</caption>
              <thead><tr className="text-white/70"><th className="p-3 text-start font-medium" scope="col">ویژگی</th><th className="p-3 text-start font-medium" scope="col">استاندارد</th><th className="p-3 text-start font-bold text-pro-gold" scope="col">پرو</th></tr></thead>
              <tbody>{PRO_ROWS.map(([a, b, c]) => <tr key={a} className="border-t border-white/10"><th scope="row" className="p-3 text-start font-bold">{a}</th><td className="p-3 text-white/70">{b}</td><td className="p-3 font-bold">{c}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

const FLEET: { kind: VehicleKind; color: string }[] = [
  { kind: "nissan", color: "white" }, { kind: "kamionet", color: "blue" }, { kind: "khavar", color: "silver" }, { kind: "truck10", color: "white" }, { kind: "trailer", color: "navy" },
];

function Fleet() {
  return (
    <section id="fleet" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl font-black tracking-tight lg:text-4xl">از وانت تا تریلی یخچال‌دار</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink-3">هر بار به خودرویی می‌رسد که دما و ظرفیت لازم را دارد.</p>
        <div className="no-scrollbar -mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-4">
          {FLEET.map((f, i) => (
            <div key={f.kind} className="card-lift w-72 shrink-0 snap-start overflow-hidden rounded-[28px] bg-white shadow-soft">
              <div className={cx("grid-dots relative grid h-44 place-items-center bg-gradient-to-br px-5", ["from-accent-50", "from-brand-50", "from-ok-bg", "from-surface-3", "from-accent-50"][i % 5], "to-white")}>
                <TruckIllustration kind={f.kind} color={f.color} state="cooling" className="h-32 w-full" />
              </div>
              <div className="flex items-center justify-between p-4"><div><div className="font-black">{VEHICLES[f.kind].short}</div><div className="text-sm text-ink-3">تا {fa(VEHICLES[f.kind].capacityKg / 1000)} تن</div></div><span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-extrabold text-accent-700">یخچال‌دار</span></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustBand() {
  const s = useStore();
  return (
    <section aria-label="بیمه‌گران" className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-center text-sm font-bold text-ink-3">محموله‌ها با طرح‌های بیمه‌ی زیر پوشش داده می‌شوند (نام‌ها نمونه است)</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-ink-2">
        {(s.ready ? s.insurers : []).map((i) => <InsurerLogo key={i.id} name={i.name} hue={i.hue} />)}
      </div>
    </section>
  );
}

function LiveLoads() {
  const s = useStore();
  const open = s.ready ? s.orders.filter((o) => o.status === "OPEN").slice(0, 6) : [];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="live-h">
      <div className="flex items-end justify-between gap-4">
        <h2 id="live-h" className="text-3xl font-black">بارهای باز همین الان</h2>
        <Link href="/driver/login/" className="inline-flex h-11 items-center text-sm font-bold text-accent-600">همه‌ی بارها در اپ راننده</Link>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!s.ready && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        {open.map((o) => (
          <article key={o.id} className="card-lift space-y-3 rounded-[24px] bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-sm font-bold"><CargoIcon type={o.cargo} />{CARGO[o.cargo].label}</span><span className="text-xs font-bold text-warn">{STATUS[o.status].label}</span></div>
            <RouteLine from={o.origin.city} to={o.dest.city} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {o.tempMin !== undefined && o.tempMax !== undefined ? <TempChip min={o.tempMin} max={o.tempMax} /> : <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold">بدون کنترل دما</span>}
              <span className="font-black">{toman(o.freight)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const FAQ: [string, string][] = [
  ["پول من کجا نگه داشته می‌شود؟", "بیعانه و مابقی کرایه در حساب امانی کامیونت می‌ماند و پس از تحویل با کد گیرنده و گذشت پنجره‌ی اعتراض به راننده منتقل می‌شود."],
  ["اگر دمای بار از بازه خارج شود چه می‌شود؟", "هر انحراف با زمان و شدت ثبت می‌شود، به شما اعلان می‌رسد و در گواهی سفر می‌آید. با بیمه‌ی مناسب می‌توانید خسارت را پیگیری کنید."],
  ["قیمت را چه کسی تعیین می‌کند؟", "صاحب بار. سیستم بازه‌ی رایج مسیر را نشان می‌دهد تا قیمت واقع‌بینانه بگذارید."],
  ["راننده‌ها چطور تأیید می‌شوند؟", "تطبیق هویت، گواهینامه، مدارک خودرو و بررسی انسانی. رانندگان پرو بازرسی خودرو هم دارند."],
  ["لغو سفارش هزینه دارد؟", "پیش از تأیید راننده رایگان است. پس از آن بسته به زمان لغو، جدول شفافی اعمال می‌شود و مبلغ دقیق پیش از تأیید نمایش داده می‌شود."],
  ["بار غیریخچالی هم حمل می‌کنید؟", "بله؛ سفارش «غیریخچالی» با خودروهای سرپوشیده یا یخچال‌دارِ خاموش و بیمه‌ی مخصوص ثبت می‌شود."],
];

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16">
      <h2 className="text-center text-3xl font-black">سؤالات پرتکرار</h2>
      <div className="mt-8 divide-y divide-line/70 overflow-hidden rounded-[28px] bg-white shadow-soft">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group p-5">
            <summary className="flex min-h-11 list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden">{q}<ChevronDown className="size-5 shrink-0 text-ink-3 transition group-open:rotate-180" aria-hidden /></summary>
            <p className="mt-2 leading-8 text-ink-3">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-ink to-[#1d2a44] p-10 text-center text-white md:p-14"><div className="blob pointer-events-none absolute -top-20 start-10 size-64 rounded-full bg-brand-500/25 blur-3xl" aria-hidden /><div className="blob pointer-events-none absolute -bottom-24 end-10 size-72 rounded-full bg-accent-500/25 blur-3xl [animation-delay:-5s]" aria-hidden />
        <div className="relative">
        <h2 className="text-3xl font-black">آماده‌اید اولین بار را بفرستید؟</h2>
        <p className="mx-auto mt-2 max-w-lg text-white/70">ثبت‌نام با شماره‌ی موبایل، کمتر از یک دقیقه.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/app/login/" size="lg">ثبت بار</ButtonLink>
          <ButtonLink href="/driver/login/" size="lg" variant="secondary">ثبت‌نام راننده</ButtonLink>
        </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
        <div><Logo /><p className="mt-3 text-sm leading-7 text-ink-3">مستقیم، شفاف، بیمه‌شده. حمل بار یخچال‌دار در سراسر ایران.</p></div>
        <FooterCol title="محصول" links={[["صاحب بار", "/app/login/"], ["راننده", "/driver/login/"], ["کامیونت پرو", "#pro"]]} />
        <FooterCol title="راهنما" links={[["چطور کار می‌کند", "#how"], ["سؤالات پرتکرار", "#faq"], ["ناوگان", "#fleet"]]} />
        <FooterCol title="ورود" links={[["انتخاب پورتال", "/login/"], ["مدیریت", "/admin/login/"]]} />
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-ink-3">© ۱۴۰۵ کامیونت · نسخه‌ی نمایشی؛ داده‌ها و بیمه‌گران نمونه هستند.</div>
    </footer>
  );
}
const FooterCol = ({ title, links }: { title: string; links: [string, string][] }) => (
  <div><div className="mb-2 text-sm font-extrabold">{title}</div><ul className="space-y-1">{links.map(([l, h]) => <li key={l}>{h.startsWith("#") ? <a href={h} className="flex h-9 items-center text-sm text-ink-3 hover:text-ink">{l}</a> : <Link href={h} className="flex h-9 items-center text-sm text-ink-3 hover:text-ink">{l}</Link>}</li>)}</ul></div>
);

export function Landing() {
  useBoot();
  return (
    <div className="bg-surface-2">
      <Header />
      <main>
        <Hero />
        <Stats />
        <HowItWorks />
        <Features />
        <ProSection />
        <Fleet />
        <TrustBand />
        <LiveLoads />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <DemoDrawer always />
    </div>
  );
}
void Star; void Crown;
