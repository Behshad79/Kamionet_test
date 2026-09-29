"use client";

import { PackagePlus, Plus, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveTempBadge } from "@/components/TempPanel";
import { Chip, FilterBar, OrderCard, OrderCardSkeleton } from "@/components/molecules";
import { Button, EmptyState, Stat } from "@/components/ui";
import { fa } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { fullView } from "@/lib/mask";
import type { OrderStatus } from "@/lib/types";

const FILTERS: { key: string; label: string; match: OrderStatus[] }[] = [
  { key: "all", label: "همه", match: [] },
  { key: "pending", label: "در انتظار", match: ["OPEN", "LOCKED"] },
  { key: "active", label: "راننده تعیین‌شده", match: ["ASSIGNED"] },
  { key: "transit", label: "در مسیر", match: ["IN_TRANSIT"] },
  { key: "done", label: "تحویل‌شده", match: ["DELIVERED"] },
  { key: "dead", label: "لغو/منقضی", match: ["CANCELLED", "EXPIRED"] },
];

export default function ShipperDashboard() {
  const { s, me, ready } = useApp();
  const [f, setF] = useState("all");
  // Shipper role only ever sees orders where they are the shipper.
  const mine = useMemo(() => (me ? s.orders.filter((o) => o.shipperId === me.id) : []), [s.orders, me]);
  const shown = useMemo(() => {
    const m = FILTERS.find((x) => x.key === f)!.match;
    return mine.filter((o) => !m.length || m.includes(o.status)).map((o) => fullView(o, s));
  }, [mine, f, s]);
  const c = (st: OrderStatus[]) => mine.filter((o) => st.includes(o.status)).length;

  return (
    <AppShell area="shipper">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">سلام {me?.name?.split(" ")[0] ?? ""}</h1>
          <p className="mt-1 text-sm text-ink-3">وضعیت سفارش‌های شما به‌صورت زنده به‌روز می‌شود.</p>
        </div>
        <Link href="/shipper/new/" className="hidden sm:block"><Button><Plus className="size-5" />سفارش جدید</Button></Link>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="در انتظار راننده" value={fa(c(["OPEN", "LOCKED"]))} />
        <Stat label="در جریان" value={fa(c(["ASSIGNED", "IN_TRANSIT"]))} tone="accent" />
        <Stat label="تحویل‌شده" value={fa(c(["DELIVERED"]))} />
      </div>

      <FilterBar>{FILTERS.map((x) => <Chip key={x.key} active={f === x.key} onClick={() => setF(x.key)}>{x.label}</Chip>)}</FilterBar>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {!ready ? [0, 1, 2, 3].map((i) => <OrderCardSkeleton key={i} />)
          : shown.map((v, i) => <OrderCard key={v.id} v={v} delay={i} href={`/shipper/order/?id=${v.id}`} footer={v.status === "IN_TRANSIT" ? <LiveTempBadge o={v} /> : undefined} />)}
      </div>
      {ready && shown.length === 0 && (
        <EmptyState
          icon={mine.length ? <Truck className="size-7" /> : <PackagePlus className="size-7" />}
          title={mine.length ? "سفارشی در این دسته نیست" : "هنوز سفارشی ثبت نکرده‌اید"}
          body={mine.length ? "فیلتر دیگری را امتحان کنید." : "اولین بار یخچالی‌تان را ثبت کنید؛ رانندگان مناسب دمای بار شما به‌صورت زنده مطلع می‌شوند."}
          action={<Link href="/shipper/new/"><Button>ثبت اولین سفارش</Button></Link>}
        />
      )}
      <Link href="/shipper/new/" className="fixed bottom-24 end-4 z-30 sm:hidden" aria-label="سفارش جدید">
        <span className="grid size-14 place-items-center rounded-full bg-brand-500 shadow-lift"><Plus className="size-6" /></span>
      </Link>
    </AppShell>
  );
}
