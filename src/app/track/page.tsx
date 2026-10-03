"use client";

import { Check, KeyRound, MapPin, PackageCheck, Truck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { MapView } from "@/components/MapView";
import { CargoLabel, RouteLine, TempChip } from "@/components/molecules";
import { StatusTimeline } from "@/components/order/parts";
import { TempPanel } from "@/components/TempPanel";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { person } from "@/lib/engine/core";
import { fa, hhmm, jShort, mmss, STATUS, weightLabel } from "@/lib/format";
import { lerp } from "@/lib/geo";
import { useNow, useQueryParam } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { telemetryOf, tripDuration, tripProgress } from "@/lib/telemetry";

/** Consignee tracking: tokenised link, no login. The delivery code is shown once the load is on the road (stands in for the SMS). */
export default function Page() {
  const t = useQueryParam("t");
  const s = useStore();
  const now = useNow(1000);
  if (t === undefined || !s.ready) return <Shell><Skeleton className="h-64" /></Shell>;
  const o = s.orders.find((x) => x.consignee.token === t);
  if (!o) return <Shell><EmptyState icon={<PackageCheck className="size-8" />} title="پیوند رهگیری معتبر نیست" body="پیوند را از فرستنده‌ی بار دوباره بگیرید." /></Shell>;
  const tel = telemetryOf(o);
  const prog = tripProgress(tel, now);
  const onRoad = ["IN_TRANSIT", "AT_DELIVERY"].includes(o.status);
  const done = ["DELIVERED", "COMPLETED"].includes(o.status);
  const pos = lerp(o.origin, o.dest, prog);
  const left = o.loadedAt ? o.loadedAt + tripDuration(tel) - now : undefined;
  const driver = person(s, o.driverId);
  const first = driver?.name.split(" ")[0];
  return (
    <Shell>
      <div className="space-y-4">
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-2"><h1 className="text-xl font-black">{o.origin.city} ← {o.dest.city}</h1><span className="rounded-full bg-act-soft px-3 py-1 text-xs font-extrabold text-act-ink">{STATUS[o.status].label}</span></div>
          <div className="flex flex-wrap items-center gap-2 text-sm"><CargoLabel type={o.cargo} />{o.tempMin !== undefined && o.tempMax !== undefined && <TempChip min={o.tempMin} max={o.tempMax} />}<span className="text-ink-3">{weightLabel(o.weightKg)}</span></div>
          <p className="text-sm text-ink-3">گیرنده: {o.consignee.name} · زمان تحویل پیش‌بینی‌شده: {jShort(o.deliverBy)}، {hhmm(o.deliverBy)}</p>
        </Card>

        {onRoad && (
          <Card className="space-y-3 border-2 border-brand-500 p-5 text-center">
            <KeyRound className="mx-auto size-7 text-brand-700" aria-hidden />
            <h2 className="font-extrabold">کد تحویل شما</h2>
            <div className="text-5xl font-black tracking-[0.3em] tabular" dir="ltr">{o.consignee.otp.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])}</div>
            <p className="text-sm leading-7 text-ink-3">این کد را فقط هنگام تحویل بار به راننده بگویید. (در نسخه‌ی نمایشی به‌جای پیامک اینجا نمایش داده می‌شود.)</p>
          </Card>
        )}
        {(o.loadedAt && !done) && (
          <Card className="overflow-hidden">
            <MapView className="h-64" markers={[{ id: "o", lat: o.origin.lat, lng: o.origin.lng, kind: "origin" }, { id: "d", lat: o.dest.lat, lng: o.dest.lng, kind: "dest" }, { id: "t", lat: pos.lat, lng: pos.lng, kind: "truck" }]} lines={[{ id: "l", points: [[o.origin.lat, o.origin.lng], [o.dest.lat, o.dest.lng]], dashed: true, tone: "accent" }]} fitKey={o.id} />
            <div className="flex items-center justify-between gap-3 p-4 text-sm"><span className="flex items-center gap-1.5 font-bold"><MapPin className="size-4" aria-hidden />{fa(Math.round(prog * 100))}٪ مسیر طی شده</span>{left !== undefined && left > 0 && <span className="text-ink-3">زمان باقی‌مانده (شبیه‌سازی): {mmss(left)}</span>}</div>
          </Card>
        )}
        {o.loadedAt && o.tempMin !== undefined && o.tempMax !== undefined && <TempPanel o={{ ...tel, tempMin: o.tempMin, tempMax: o.tempMax, status: o.status }} />}
        {!o.loadedAt && <Card className="flex items-center gap-3 p-5 text-sm text-ink-3"><Truck className="size-6" aria-hidden />{o.assignedAt ? "راننده تعیین شده و به‌زودی بارگیری آغاز می‌شود." : "هنوز راننده‌ای تعیین نشده است."}</Card>}
        {done && <Card className="space-y-3 p-5"><h2 className="flex items-center gap-2 font-extrabold text-ok"><Check className="size-5" aria-hidden />بار تحویل داده شد</h2><Link href={`/certificate/?t=${o.consignee.token}`} className="inline-flex h-11 items-center font-bold text-accent-600">مشاهده‌ی گواهی زنجیره‌ی سرد</Link></Card>}
        {driver && o.assignedAt && <Card className="space-y-1 p-5 text-sm"><div className="text-ink-3">راننده</div><div className="font-black">{first}</div></Card>}
        <Card className="p-5"><h2 className="mb-3 font-extrabold">روند سفر</h2><StatusTimeline o={o} /></Card>
        <RouteLine from={o.origin.city} to={o.dest.city} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main data-portal="shipper" className="min-h-dvh bg-tint pb-10">
      <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/60 px-4"><Logo /><span className="text-sm font-bold text-ink-3">رهگیری بار</span></header>
      <div className="mx-auto max-w-xl p-4">{children}</div>
    </main>
  );
}
