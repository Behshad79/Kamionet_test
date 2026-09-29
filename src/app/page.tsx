"use client";

import { ArrowLeft, Lock, Radio, ShieldCheck, Snowflake, Thermometer, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { DriverBanner } from "@/components/DriverBanner";
import { MapView } from "@/components/MapView";
import { OrderCard, OrderCardSkeleton } from "@/components/molecules";
import { ButtonLink, Card, Stat } from "@/components/ui";
import { fa } from "@/lib/format";
import { cityByName } from "@/lib/geo";
import { useApp } from "@/lib/hooks";
import { fullView, guestView, publicView } from "@/lib/mask";
import { matchVehicle } from "@/lib/matching";
import { driverNet } from "@/lib/pricing";
import type { Order } from "@/lib/types";

const FEATURES = [
  { icon: Thermometer, title: "تطبیق دقیق دما و خودرو", body: "بار شما فقط به رانندگانی می‌رسد که نوع خودرو، ظرفیت و یخچالشان واقعاً با بار جور است." },
  { icon: Lock, title: "حریم اطلاعات بار", body: "نشانی دقیق و شماره‌ها تا لحظه‌ی تخصیص قطعی پنهان می‌ماند؛ رقبا چیزی نمی‌بینند." },
  { icon: ShieldCheck, title: "رانندگان احراز‌شده و بیمه", body: "کارت هوشمند، گواهینامه، بیمه و معاینه فنی پیش از فعال‌سازی بررسی می‌شود و بار می‌تواند بیمه شود." },
  { icon: Radio, title: "دمای بار تا تحویل", body: "مسیر راننده و نمودار دمای بار را زنده ببینید و اگر دما از بازه خارج شد، فوراً خبردار شوید." },
];

/** Sample loads that read as real demand: different origins and routes, not three copies of one lane. */
function varied(list: Order[], n: number) {
  const seenRoute = new Set<string>();
  const seenOrigin = new Set<string>();
  const out: Order[] = [];
  for (const o of list) {
    const route = `${o.origin.city}>${o.dest.city}`;
    if (seenRoute.has(route) || seenOrigin.has(o.origin.city)) continue;
    seenRoute.add(route);
    seenOrigin.add(o.origin.city);
    out.push(o);
    if (out.length === n) return out;
  }
  for (const o of list) {
    const route = `${o.origin.city}>${o.dest.city}`;
    if (out.length < n && !seenRoute.has(route)) { seenRoute.add(route); out.push(o); }
  }
  return out;
}

export default function Home() {
  const { s, ready, me, role, driver } = useApp();
  const open = useMemo(() => s.orders.filter((o) => o.status === "OPEN").sort((a, b) => b.createdAt - a.createdAt), [s.orders]);

  // Hero visual: a live look at demand, city-level only (the detail a guest is allowed to see).
  const cities = useMemo(() => {
    const by = new Map<string, number>();
    open.forEach((o) => by.set(o.origin.city, (by.get(o.origin.city) ?? 0) + 1));
    return by;
  }, [open]);
  const markers = useMemo(
    () => [...cities].map(([city, n]) => ({ id: city, lat: cityByName(city).lat, lng: cityByName(city).lng, kind: "order" as const, label: `${fa(n)} بار` })),
    [cities],
  );

  const guestCards = useMemo(() => varied(open, 3).map(guestView), [open]);
  const mine = useMemo(() => (me ? s.orders.filter((o) => o.shipperId === me.id).slice(0, 4).map((o) => fullView(o, s)) : []), [s, me]);
  const forDriver = useMemo(() => {
    if (!me) return [];
    const list = open.filter((o) => o.shipperId !== me.id).filter((o) => !driver?.vehicle.plate || matchVehicle(driver.vehicle, o).ok);
    return varied(list, 3).map((o) => publicView(o, me.id, s.ratings));
  }, [open, me, driver, s.ratings]);

  const greet = me?.name && me.name !== "کاربر جدید" ? me.name.split(" ")[0] : "";
  const count = (st: string[]) => (me ? s.orders.filter((o) => o.shipperId === me.id && st.includes(o.status)).length : 0);

  return (
    <AppShell wide>
      <section className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <div className="relative overflow-hidden rounded-ui bg-white px-6 py-10 shadow-soft sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -start-24 -top-24 size-72 rounded-full bg-brand-100 opacity-70 blur-3xl" />
          <div className="relative animate-rise">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent-50 px-3.5 py-1.5 text-sm font-bold text-accent-700"><Snowflake className="size-4" aria-hidden />مستقیم، شفاف، بیمه‌شده</span>
            <h1 className="text-3xl font-black leading-[1.45] sm:text-5xl sm:leading-[1.4]">
              {me ? <>سلام{greet ? ` ${greet}` : ""}،<br />امروز چه باری داری؟</> : <>بار یخچالی؟<br /><span className="rounded-ui bg-brand-500 px-2">کامیونت</span> پیدایش می‌کند.</>}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-ink-2 sm:text-lg">
              {me
                ? role === "driver" ? "بارهای سازگار با خودرو و یخچال شما را ببینید و همان لحظه رزرو کنید." : "سفارش جدید ثبت کنید یا وضعیت بارهای در مسیرتان را از داشبورد ببینید."
                : "لبنیات، گوشت، دارو و بستنی را با نزدیک‌ترین خودروی یخچال‌دار مطمئن در سراسر ایران جابه‌جا کنید؛ یا اگر راننده‌اید، بار مناسب دمای یخچالتان را روی نقشه ببینید."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {me ? (
                <>
                  <ButtonLink href={role === "driver" ? "/driver/" : "/shipper/new/"} size="lg">{role === "driver" ? "بازار بار" : "ثبت سفارش حمل"}<ArrowLeft className="size-5" /></ButtonLink>
                  <ButtonLink href={role === "driver" ? "/driver/trips/" : "/shipper/"} size="lg" variant="secondary">{role === "driver" ? "سفرهای من" : "سفارش‌های من"}</ButtonLink>
                </>
              ) : (
                <>
                  <ButtonLink href="/login/?as=shipper" size="lg">ثبت سفارش حمل<ArrowLeft className="size-5" /></ButtonLink>
                  <ButtonLink href="/login/?as=driver" size="lg" variant="secondary"><Truck className="size-5" />من راننده‌ام</ButtonLink>
                </>
              )}
            </div>
          </div>
        </div>

        <Card className="relative h-72 overflow-hidden lg:h-auto lg:min-h-[420px]">
          <div className="pointer-events-none absolute inset-0"><MapView markers={markers} fitKey={`${markers.length}`} className="size-full" /></div>
          <div className="absolute inset-x-3 bottom-3 z-[500] flex items-center justify-between gap-3 rounded-ui bg-white/95 p-3 shadow-lift backdrop-blur">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black"><span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-ok" /></span>{fa(open.length)} بار باز در {fa(cities.size)} شهر</div>
              <div className="text-xs text-ink-3">نمایش شهری؛ جزئیات فقط پس از ورود</div>
            </div>
            <Link href="/orders/" className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-surface-3 px-4 text-sm font-bold hover:bg-line">همه‌ی بارها</Link>
          </div>
        </Card>
      </section>

      {!me && (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="animate-rise rounded-ui bg-white p-5 shadow-soft" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="mb-3 grid size-11 place-items-center rounded-ui bg-brand-50 text-brand-700"><f.icon className="size-5" aria-hidden /></span>
              <h3 className="font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-7 text-ink-3">{f.body}</p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-10">
        {me && role === "shipper" && (
          <>
            <div className="mb-4 flex items-end justify-between"><h2 className="text-xl font-black">آخرین سفارش‌های شما</h2><Link href="/shipper/" className="inline-flex min-h-11 items-center text-sm font-bold text-accent-600">داشبورد</Link></div>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Stat label="در انتظار راننده" value={fa(count(["OPEN", "LOCKED"]))} />
              <Stat label="در جریان" value={fa(count(["ASSIGNED", "IN_TRANSIT"]))} tone="accent" />
              <Stat label="تحویل‌شده" value={fa(count(["DELIVERED"]))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {!ready ? [0, 1, 2].map((i) => <OrderCardSkeleton key={i} />) : mine.length ? mine.map((v, i) => <OrderCard key={v.id} v={v} delay={i} href={`/shipper/order/?id=${v.id}`} />)
                : <Card className="p-6 text-sm text-ink-3 sm:col-span-2 lg:col-span-3">هنوز سفارشی ثبت نکرده‌اید. اولین بار یخچالی‌تان را ثبت کنید.</Card>}
            </div>
          </>
        )}

        {me && role === "driver" && (
          <>
            <DriverBanner />
            <div className="mb-4 flex items-end justify-between"><h2 className="text-xl font-black">بارهای سازگار با خودروی شما</h2><Link href="/driver/" className="inline-flex min-h-11 items-center text-sm font-bold text-accent-600">همه‌ی بارها</Link></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {!ready ? [0, 1, 2].map((i) => <OrderCardSkeleton key={i} />) : forDriver.map((v, i) => <OrderCard key={v.id} v={v} delay={i} hideOpenStatus net={driverNet(v.price, s.config)} href={`/driver/order/?id=${v.id}`} />)}
            </div>
          </>
        )}

        {!me && (
          <>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">بارهای باز الان</h2>
                <p className="mt-1 text-sm text-ink-3">برای دیدن نوع بار، دما و زمان، وارد شوید. مهمان‌ها فقط شهر و بازه‌ی تقریبی کرایه را می‌بینند.</p>
              </div>
              <Link href="/orders/" className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold text-accent-600">همه‌ی بارها</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {!ready ? [0, 1, 2].map((i) => <OrderCardSkeleton key={i} />) : guestCards.map((v, i) => <OrderCard key={v.id} v={v} delay={i} hideOpenStatus href="/login/?as=driver" />)}
            </div>
          </>
        )}
      </section>

      <footer className="mt-16 border-t border-line py-6 text-sm text-ink-3">کامیونت · نسخه‌ی نمایشی · kamionet.com</footer>
    </AppShell>
  );
}
