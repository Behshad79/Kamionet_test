"use client";

import { ArrowLeft, Clock, Lock, Radio, ShieldCheck, Snowflake, Thermometer, Truck } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { OrderCard, OrderCardSkeleton } from "@/components/molecules";
import { Button } from "@/components/ui";
import { useApp } from "@/lib/hooks";
import { guestView } from "@/lib/mask";

const FEATURES = [
  { icon: Thermometer, title: "تطبیق دمایی هوشمند", body: "بار شما فقط به رانندگانی می‌رسد که یخچال خودرویشان دمای موردنیاز را واقعاً تأمین می‌کند." },
  { icon: Lock, title: "حریم اطلاعات بار", body: "نشانی دقیق و شماره‌ها تا لحظه‌ی تخصیص قطعی پنهان می‌ماند؛ رقبا چیزی نمی‌بینند." },
  { icon: ShieldCheck, title: "رانندگان احراز‌شده", body: "کارت هوشمند، گواهینامه، بیمه و معاینه فنی؛ همه پیش از فعال‌سازی بررسی می‌شود." },
  { icon: Radio, title: "ردیابی زنده تا تحویل", body: "از بارگیری تا تخلیه، مسیر راننده و عکس فاکتورهای زمان‌دار را ببینید." },
];

export default function Home() {
  const { s, ready, me, role } = useApp();
  const open = s.orders.filter((o) => o.status === "OPEN").slice(0, 3);
  return (
    <AppShell wide>
      <section className="relative -mx-4 -mt-5 overflow-hidden bg-white px-4 pb-14 pt-12 sm:mx-0 sm:mt-0 sm:rounded-ui sm:px-12 sm:shadow-soft">
        <div className="pointer-events-none absolute -start-24 -top-24 size-80 rounded-full bg-brand-100 opacity-70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 end-0 size-80 rounded-full bg-accent-100 opacity-70 blur-3xl" />
        <div className="relative max-w-2xl animate-rise">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent-50 px-3.5 py-1.5 text-sm font-bold text-accent-700"><Snowflake className="size-4" />زنجیره‌ی سرد، بدون واسطه</span>
          <h1 className="text-4xl font-black leading-[1.35] sm:text-5xl">
            بار یخچالی؟<br />
            <span className="rounded-ui bg-brand-500 px-2">کامیونت</span> پیدایش می‌کند.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-ink-2">
            لبنیات، گوشت، دارو و بستنی را با نزدیک‌ترین کامیونت یخچال‌دار مطمئن در سراسر ایران جابه‌جا کنید؛ یا اگر راننده‌اید، بار مناسب دمای یخچالتان را روی نقشه ببینید.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={me ? "/shipper/new/" : "/login/?as=shipper"}><Button size="lg">ثبت سفارش حمل <ArrowLeft className="size-5" /></Button></Link>
            <Link href={me ? "/driver/" : "/login/?as=driver"}><Button size="lg" variant="secondary"><Truck className="size-5" />من راننده‌ام</Button></Link>
          </div>
          {me && <p className="mt-4 text-sm text-ink-3">وارد شده‌اید؛ نقش فعلی: {role === "driver" ? "راننده" : "صاحب بار"}</p>}
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <div key={f.title} className="animate-rise rounded-ui bg-white p-5 shadow-soft" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="mb-3 grid size-11 place-items-center rounded-ui bg-brand-50 text-brand-700"><f.icon className="size-5" /></span>
            <h3 className="font-bold">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-7 text-ink-3">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-black">بارهای باز الان</h2>
            <p className="mt-1 text-sm text-ink-3">برای دیدن جزئیات، ثبت‌نام کنید. مبدأ، مقصد و بازه‌ی کرایه برای مهمان‌ها نمایش داده می‌شود.</p>
          </div>
          <Link href="/orders/" className="text-sm font-bold text-accent-600">همه‌ی بارها</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!ready ? [0, 1, 2].map((i) => <OrderCardSkeleton key={i} />) : open.map((o, i) => <OrderCard key={o.id} v={guestView(o)} delay={i} href="/login/" />)}
        </div>
      </section>

      <footer className="mt-16 flex items-center gap-2 border-t border-line py-6 text-sm text-ink-3">
        <Clock className="size-4" /> کامیونت · نسخه‌ی نمایشی · kamionet.com
      </footer>
    </AppShell>
  );
}
