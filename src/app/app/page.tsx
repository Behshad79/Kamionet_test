"use client";

import { usePortal } from "@/lib/hooks";
import { fa } from "@/lib/format";
import { Card, Stat } from "@/components/ui";

export default function Page() {
  const { s, me } = usePortal("shipper");
  const mine = s.orders.filter((o) => o.shipperId === me?.id);
  const active = mine.filter((o) => !["COMPLETED", "EXPIRED", "DRAFT"].includes(o.status) && !o.status.startsWith("CANCELLED"));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">سلام، {me?.name}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="سفارش فعال" value={fa(active.length)} />
        <Stat label="کل سفارش‌ها" value={fa(mine.length)} />
      </div>
      <Card className="p-5 text-sm text-ink-3">داشبورد کامل در مرحله‌ی M2 ساخته می‌شود.</Card>
    </div>
  );
}
