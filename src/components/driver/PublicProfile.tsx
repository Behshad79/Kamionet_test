"use client";

import { Crown } from "lucide-react";
import { TruckIllustration } from "../graphics/TruckIllustration";
import { ProBadge } from "../brand";
import { CleanBadge } from "../order/parts";
import { ProfileHero, ReviewItem } from "../profile";
import { Badge, Card, Progress } from "../ui";
import { person } from "@/lib/engine/core";
import { driverStats } from "@/lib/engine/stats";
import { fa, jShort } from "@/lib/format";
import { vehicleTitle } from "@/lib/vehicles";
import { SensorBadge, VehicleSpecs } from "./vehicleUi";
import type { DriverProfile, State } from "@/lib/types";

const CRIT: Record<string, string> = { punctuality: "وقت‌شناسی", cleanliness: "نظافت و بو", coldchain: "رعایت زنجیره‌ی سرد", behavior: "رفتار", communication: "ارتباط" };

/** What a shipper sees when they open a driver: freelancer-style profile. Phone and plate stay hidden until the deposit is paid. */
export function DriverPublicProfile({ d, s }: { d: DriverProfile; s: State }) {
  const st = driverStats(s, d.personId);
  const p = person(s, d.personId);
  const pro = d.pro.status === "pro";
  const clean = !!d.clean.badgeUntil && d.clean.badgeUntil > Date.now();
  const since = Math.max(1, Math.round((Date.now() - d.createdAt) / (30 * 86_400_000)));
  return (
    <div className="space-y-4">
      <ProfileHero name={p?.name ?? "راننده"} hue={(d.personId.length * 61) % 360} pro={pro} verified rating={st.rating} ratingCount={st.ratingCount} headline={`${vehicleTitle(d.vehicle)} · عضو از ${fa(since)} ماه پیش`}
        badges={<>{pro && <ProBadge />}{d.vehicle.thermo?.connected && <SensorBadge />}{clean && <CleanBadge />}<Badge tone="ok">مدارک تأییدشده</Badge></>}
        stats={[{ label: "سفر", value: fa(st.trips) }, { label: "وقت‌شناسی", value: `${fa(Math.round(st.onTime * 100))}٪` }, { label: "لغو", value: `${fa(Math.round(st.cancelRate * 100))}٪` }]} />
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-4"><TruckIllustration kind={d.vehicle.kind} color={d.vehicle.color} state="cooling" className="h-24 w-36 shrink-0" label="خودروی راننده" /><div className="min-w-0 space-y-1 text-sm"><h2 className="font-extrabold">خودرو</h2><div className="font-black">{vehicleTitle(d.vehicle)}</div>{pro && <div className="flex items-center gap-1.5 text-brand-700"><Crown className="size-4" aria-hidden />بازرسی‌شده‌ی کامیونت</div>}</div></div>
        <VehicleSpecs v={d.vehicle} hideTitle />
      </Card>
      <Card className="space-y-3 p-5"><h2 className="font-extrabold">ریز امتیازها</h2>{Object.entries(st.breakdown).map(([k, v]) => <div key={k} className="flex items-center gap-3 text-sm"><span className="w-32 shrink-0 text-ink-3">{CRIT[k] ?? k}</span><Progress value={(v / 5) * 100} /><span className="w-8 text-end font-bold tabular">{fa(Math.round(v * 10) / 10)}</span></div>)}</Card>
      <Card className="space-y-4 p-5"><h2 className="font-extrabold">نظر صاحبان بار</h2>{st.recent.length === 0 ? <p className="text-sm text-ink-3">هنوز نظر عمومی ثبت نشده است.</p> : st.recent.slice(0, 5).map((r) => <ReviewItem key={r.id} name={person(s, r.fromId)?.name ?? "صاحب بار"} rating={r.overall} text={r.comment} at={jShort(r.at)} hue={(r.fromId.length * 53) % 360} />)}</Card>
      <p className="text-center text-xs text-ink-3">پلاک و شماره‌ی تماس راننده پس از پرداخت بیعانه نمایش داده می‌شود.</p>
    </div>
  );
}
