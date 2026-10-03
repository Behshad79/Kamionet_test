"use client";

import { usePortal } from "@/lib/hooks";
import { fa } from "@/lib/format";
import { Card, Stat } from "@/components/ui";
import { STAGE_LABEL } from "@/lib/engine/drivers";

export default function Page() {
  const { s, me, stage } = usePortal("driver");
  const open = s.orders.filter((o) => o.status === "OPEN" || o.status === "PRO_POOL").length;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">سلام، {me?.name}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="بار باز" value={fa(open)} />
        <Stat label="وضعیت حساب" value={stage ? STAGE_LABEL[stage] : "—"} />
      </div>
      <Card className="p-5 text-sm text-ink-3">بازار بار در مرحله‌ی M3 ساخته می‌شود.</Card>
    </div>
  );
}
