"use client";

import Link from "next/link";
import { Clock, Radio, Send } from "lucide-react";
import { useState } from "react";
import { AvailLine, TimesChip } from "@/components/driver/Availability";
import { SensorBadge } from "@/components/driver/vehicleUi";
import { Avatar } from "@/components/profile";
import { RouteLine } from "@/components/molecules";
import { toast } from "@/components/Toaster";
import { Badge, Button, ButtonLink, Card, EmptyState, Input, Sheet } from "@/components/ui";
import { fitReasons, liveAvailabilities, probeOf, requestFreeDriver } from "@/lib/engine/avail";
import { person } from "@/lib/engine/core";
import { driverStats } from "@/lib/engine/stats";
import { fa, jDateTime, mmss } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { act } from "@/lib/store";
import type { Availability, Order, State } from "@/lib/types";
import { usePortal } from "@/lib/hooks";
import { vehicleTitle } from "@/lib/vehicles";

/** What the shipper can do with one free driver: send an active open load, see why none fits, or wait for the answer. */
function SendLoad({ s, a, meId }: { s: State; a: Availability; meId: string }) {
  const [open, setOpen] = useState(false);
  const now = useNow(1000);
  const mine = s.orders.filter((o) => o.shipperId === meId);
  const waiting = mine.filter((o) => o.status === "DIRECT_REQUESTED" && o.directDriverId === a.driverId);
  const opens = mine.filter((o) => o.status === "OPEN");
  const fits = opens.filter((o) => fitReasons(s, a, probeOf(o)).length === 0);
  const send = (o: Order) => { const r = act((st) => requestFreeDriver(st, meId, o.id, a.driverId)); toast(r.ok ? "درخواست برای راننده ارسال شد؛ منتظر پاسخ بمانید." : r.error, r.ok ? "ok" : "err"); if (r.ok) setOpen(false); };
  return (
    <div className="space-y-2 border-t border-line pt-3">
      {waiting.map((o) => (
        <Link key={o.id} href={`/app/order/?id=${o.id}`} className="flex min-h-11 items-center gap-2 rounded-ui bg-warn-bg px-3 text-sm font-bold text-warn"><Clock className="size-4 shrink-0" aria-hidden />منتظر پاسخ راننده برای بار {o.origin.city} ← {o.dest.city}{o.directExpiresAt ? <span className="ms-auto tabular">{mmss(o.directExpiresAt - now)}</span> : null}</Link>
      ))}
      {fits.length > 0 && <Button block onClick={() => (fits.length === 1 ? send(fits[0]) : setOpen(true))}><Send className="size-4" aria-hidden />ارسال بار فعال من به این راننده{fits.length > 1 ? ` (${fa(fits.length)} بار مناسب)` : ""}</Button>}
      {fits.length === 0 && opens.length > 0 && (
        <div className="space-y-1.5 rounded-ui bg-surface-2 p-3 text-xs leading-6 text-ink-2"><b>بار فعال شما با این راننده نمی‌خواند:</b>
          <ul className="list-disc ps-5">{opens.slice(0, 2).map((o) => <li key={o.id}>{o.origin.city} ← {o.dest.city}: {fitReasons(s, a, probeOf(o))[0]}</li>)}</ul></div>
      )}
      {opens.length === 0 && waiting.length === 0 && <ButtonLink href="/app/new/" variant="secondary" block>سفارش جدید برای این مسیر</ButtonLink>}
      <Sheet open={open} onClose={() => setOpen(false)} title="کدام بار برای این راننده ارسال شود؟">
        <ul className="space-y-2">{fits.map((o) => <li key={o.id}><button type="button" onClick={() => send(o)} className="w-full rounded-ui border border-line p-3 text-start hover:bg-surface-2"><RouteLine from={o.origin.city} to={o.dest.city} /><div className="mt-1 text-xs text-ink-3">بارگیری {jDateTime(o.pickupAt)} · {fa(o.weightKg)} کیلوگرم</div></button></li>)}</ul>
        <p className="mt-3 text-xs leading-6 text-ink-3">راننده ۱۰ دقیقه فرصت پاسخ دارد. اگر نپذیرد یا مهلت تمام شود، بار دوباره برای همه‌ی رانندگان باز می‌شود.</p>
      </Sheet>
    </div>
  );
}

/** Every driver who announced «I'm free»: browse by route, then start an order that suggests them. */
export default function Page() {
  const { s, me } = usePortal("shipper");
  const [q, setQ] = useState("");
  const rows = liveAvailabilities(s).filter((a) => !q || `${a.from} ${a.to.join(" ")}`.includes(q));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black">رانندگان آزاد</h1><p className="text-sm text-ink-3">رانندگانی که همین حالا مبدأ، مقصد، مبلغ و شرایطشان را اعلام کرده‌اند.</p></div><ButtonLink href="/app/new/">ثبت سفارش</ButtonLink></div>
      <Input aria-label="جستجوی مسیر" placeholder="جستجوی شهر مبدأ یا مقصد…" value={q} onChange={(e) => setQ(e.target.value)} />
      {rows.length === 0 ? <EmptyState icon={<Radio className="size-8" />} title="راننده‌ی آزادی با این مسیر پیدا نشد" body="ثبت سفارش کنید؛ هر راننده‌ی آزاد مناسب بلافاصله خبردار می‌شود." action={<ButtonLink href="/app/new/">ثبت سفارش</ButtonLink>} /> : (
        <div className="grid gap-3 md:grid-cols-2">{rows.map((a) => { const d = s.drivers.find((x) => x.personId === a.driverId); if (!d) return null; const st = driverStats(s, a.driverId); return (
          <Card key={a.id} className="space-y-3 p-4">
            <div className="flex items-center gap-3"><Avatar name={person(s, a.driverId)?.name ?? ""} pro={d.pro.status === "pro"} size={46} hue={(a.driverId.length * 61) % 360} /><div className="min-w-0 flex-1"><Link href={`/app/driver/?id=${a.driverId}`} className="font-black text-accent-700 hover:underline">{person(s, a.driverId)?.name}</Link><div className="truncate text-xs text-ink-3">{vehicleTitle(d.vehicle)} · {fa(Math.round(st.rating * 10) / 10)} از ۵</div></div>{d.vehicle.thermo?.connected && <SensorBadge />}</div>
            <p className="text-sm leading-7"><AvailLine a={a} />{a.acceptAuto && <Badge tone="ok" className="ms-2">پذیرش خودکار</Badge>}</p>
            {a.note && <p className="text-xs leading-6 text-ink-3">شرط راننده: {a.note}</p>}
            <TimesChip s={s} pid={a.driverId} />
            {me && <SendLoad s={s} a={a} meId={me.id} />}
          </Card>); })}</div>
      )}
    </div>
  );
}
