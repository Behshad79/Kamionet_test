"use client";

import { Route } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge, RouteLine } from "@/components/molecules";
import { Card, EmptyState, Tabs } from "@/components/ui";
import { driverNetFor } from "@/lib/engine/pay";
import { fa, jShort, hhmm, toman } from "@/lib/format";
import { usePortal } from "@/lib/hooks";

type Tab = "active" | "done" | "cancelled";
const ACTIVE = ["LOCKED", "AWAITING_DEPOSIT", "ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "MISMATCH_REVIEW", "IN_TRANSIT", "AT_DELIVERY", "DELIVERED", "DISPUTED"];

export default function Page() {
  const { s, me } = usePortal("driver");
  const [tab, setTab] = useState<Tab>("active");
  const mine = s.orders.filter((o) => o.driverId === me?.id || (o.status === "LOCKED" && o.lockedBy === me?.id));
  const by = (t: Tab) => mine.filter((o) => (t === "active" ? ACTIVE.includes(o.status) : t === "done" ? o.status === "COMPLETED" : o.status.startsWith("CANCELLED")));
  const list = by(tab);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">سفرهای من</h1>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "active", label: "جاری", count: by("active").length }, { id: "done", label: "انجام‌شده", count: by("done").length }, { id: "cancelled", label: "لغو‌شده", count: by("cancelled").length }]} />
      {list.length === 0 ? <EmptyState icon={<Route className="size-8" />} title="سفری در این بخش نیست" action={<Link href="/driver/" className="font-bold text-accent-600">مشاهده‌ی بارها</Link>} /> : (
        <div className="space-y-3">{list.slice(0, 60).map((o) => (
          <Link key={o.id} href={o.status === "LOCKED" ? `/driver/order/?id=${o.id}` : `/driver/trip/?id=${o.id}`} className="block"><Card className="space-y-3 p-4">
            <div className="flex items-center justify-between"><span className="text-sm text-ink-3">{jShort(o.pickupAt)}، {hhmm(o.pickupAt)}</span><StatusBadge status={o.status} /></div>
            <RouteLine from={o.origin.city} to={o.dest.city} />
            <div className="flex items-center justify-between border-t border-line pt-3 text-sm"><span className="text-ink-3">{fa(o.distanceKm)} کیلومتر</span><span className="font-black text-ok">{toman(driverNetFor(s, o).net)}</span></div>
          </Card></Link>
        ))}</div>
      )}
    </div>
  );
}
