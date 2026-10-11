"use client";

import Link from "next/link";
import { Radio } from "lucide-react";
import { useState } from "react";
import { AvailLine, TimesChip } from "@/components/driver/Availability";
import { SensorBadge } from "@/components/driver/vehicleUi";
import { Avatar } from "@/components/profile";
import { Badge, ButtonLink, Card, EmptyState, Input } from "@/components/ui";
import { liveAvailabilities } from "@/lib/engine/avail";
import { person } from "@/lib/engine/core";
import { driverStats } from "@/lib/engine/stats";
import { fa } from "@/lib/format";
import { usePortal } from "@/lib/hooks";
import { vehicleTitle } from "@/lib/vehicles";

/** Every driver who announced «I'm free»: browse by route, then start an order that suggests them. */
export default function Page() {
  const { s } = usePortal("shipper");
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
          </Card>); })}</div>
      )}
    </div>
  );
}
