"use client";

import { Route } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { OrderCard, OrderCardSkeleton } from "@/components/molecules";
import { Button, EmptyState, Stat } from "@/components/ui";
import { fa, toman } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { fullView, publicView } from "@/lib/mask";
import { driverNet } from "@/lib/pricing";

export default function Trips() {
  const { s, me, ready } = useApp();
  const mine = s.orders.filter((o) => o.driverId === me?.id || (o.status === "LOCKED" && o.lockedBy === me?.id));
  const done = mine.filter((o) => o.status === "DELIVERED");
  const earned = done.reduce((n, o) => n + driverNet(o.price, s.config), 0);
  const active = mine.filter((o) => !["DELIVERED"].includes(o.status));
  return (
    <AppShell area="driver">
      <h1 className="mb-4 text-2xl font-black">سفرهای من</h1>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Stat label="سفر تکمیل‌شده" value={fa(done.length)} />
        <Stat label="درآمد خالص" value={<span className="text-xl">{toman(earned)}</span>} tone="accent" />
      </div>
      {!ready ? <OrderCardSkeleton /> : mine.length === 0 ? (
        <EmptyState icon={<Route className="size-7" />} title="هنوز سفری ندارید" body="از بازار بار، اولین سفارش مناسب خودتان را انتخاب کنید." action={<Link href="/driver/"><Button>رفتن به بازار بار</Button></Link>} />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && <section className="space-y-3"><h2 className="font-bold">در جریان</h2>{active.map((o, i) => <OrderCard key={o.id} v={o.status === "LOCKED" ? publicView(o, me?.id) : fullView(o, s)} delay={i} net={driverNet(o.price, s.config)} href={o.status === "LOCKED" ? `/driver/order/?id=${o.id}` : `/driver/trip/?id=${o.id}`} />)}</section>}
          {done.length > 0 && <section className="space-y-3"><h2 className="font-bold">تکمیل‌شده</h2>{done.map((o, i) => <OrderCard key={o.id} v={fullView(o, s)} delay={i} net={driverNet(o.price, s.config)} href={`/driver/trip/?id=${o.id}`} />)}</section>}
        </div>
      )}
    </AppShell>
  );
}
