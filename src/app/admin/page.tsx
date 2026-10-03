"use client";

import { usePortal } from "@/lib/hooks";
import { fa } from "@/lib/format";
import { Card, Stat } from "@/components/ui";

export default function Page() {
  const { s, admin } = usePortal("admin");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">خوش آمدید، {admin?.name}</h1>
      <div className="grid grid-cols-4 gap-3">
        <Stat label="سفارش‌ها" value={fa(s.orders.length)} />
        <Stat label="رانندگان" value={fa(s.drivers.length)} />
        <Stat label="صاحبان بار" value={fa(s.shippers.length)} />
        <Stat label="ثبت‌های دفتر کل" value={fa(s.ledger.length)} />
      </div>
      <Card className="p-5 text-sm text-ink-3">کنسول کامل در مرحله‌ی M5 ساخته می‌شود.</Card>
    </div>
  );
}
