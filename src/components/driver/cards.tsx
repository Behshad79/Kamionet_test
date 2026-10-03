"use client";

import { BadgeCheck, CalendarClock, Gift, HandCoins, Navigation, Sparkles } from "lucide-react";
import Link from "next/link";
import { CARGO, fa, hhmm, jShort, PAY_TERMS, toman, weightLabel } from "@/lib/format";
import { driverNetFor } from "@/lib/engine/pay";
import { roadKm } from "@/lib/geo";
import { VEHICLES } from "@/lib/vehicles";
import type { Order, PublicView } from "@/lib/types";
import { ProBadge } from "../brand";
import { CargoIcon, RatingPill, RouteLine, TempChip } from "../molecules";
import { CleanBadge, OdorChip } from "../order/parts";
import { Badge, Card, cx } from "../ui";

export function DriverOrderCard({ v, o, net, from, fit, href }: { v: PublicView; o: Order; net: number; from?: { lat: number; lng: number }; fit: { ok: boolean; why?: string }; href: string }) {
  const dead = from ? roadKm(from, v.originArea) : undefined;
  return (
    <Link href={href} className="block">
      <Card className={cx("space-y-3 p-4 transition active:scale-[0.99]", !fit.ok && "opacity-60")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold"><CargoIcon type={v.cargo} />{CARGO[v.cargo].label}{v.cargoMode === "AMBIENT" && <Badge>غیریخچالی</Badge>}</span>
          <div className="flex flex-wrap items-center gap-1.5">{v.serviceClass === "PRO" && <ProBadge />}{v.isDirectToMe && <Badge tone="brand">درخواست مستقیم</Badge>}{v.tipPre > 0 && <Badge tone="ok"><Gift className="size-3.5" aria-hidden />انعام {toman(v.tipPre)}</Badge>}</div>
        </div>
        <RouteLine from={v.originCity} to={v.destCity} />
        <div className="flex flex-wrap items-center gap-2">
          {v.tempMin !== undefined && v.tempMax !== undefined && <TempChip min={v.tempMin} max={v.tempMax} />}
          <OdorChip odor={v.odor} sensitive={v.odorSensitive} />
          {v.cleanOnly && <CleanBadge />}
          {v.terms === "CASH_BALANCE_TO_DRIVER" && <Badge tone="info"><HandCoins className="size-3.5" aria-hidden />بخشی نقد</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
          <span className="inline-flex items-center gap-1"><CalendarClock className="size-4" aria-hidden />{jShort(v.pickupAt)}، {hhmm(v.pickupAt)}</span>
          <span>{fa(v.distanceKm)} کیلومتر</span><span>{VEHICLES[v.vehicleKind].short} · {weightLabel(v.weightKg)}</span>
          {dead !== undefined && <span className="inline-flex items-center gap-1"><Navigation className="size-4" aria-hidden />{fa(dead)} کیلومتر تا مبدأ</span>}
        </div>
        <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
          <div className="min-w-0 space-y-1"><div className="flex items-center gap-1 truncate text-sm font-medium">{v.shipper.name}{v.shipper.verified && <BadgeCheck className="size-4 text-accent-600" aria-label="تأییدشده" />}</div><RatingPill r={v.shipper.rating} /></div>
          <div className="text-end"><div className="text-xs text-ink-3">درآمد خالص شما</div><div className="text-xl font-black text-ok tabular">{toman(net)}</div></div>
        </div>
        {!fit.ok && <p className="rounded-ui bg-surface-2 p-2 text-xs text-ink-3">{fit.why}</p>}
        {o.status === "LOCKED" && v.lockedByMe && <p className="flex items-center gap-1.5 text-sm font-bold text-warn"><Sparkles className="size-4" aria-hidden />در انتظار تأیید نهایی شما</p>}
      </Card>
    </Link>
  );
}
void PAY_TERMS; void driverNetFor;
