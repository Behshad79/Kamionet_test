"use client";

import { PackagePlus, Plus, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveTempBadge } from "@/components/TempPanel";
import { Chip, FilterBar, OrderCard, OrderCardSkeleton, OrderGroupCard } from "@/components/molecules";
import { ButtonLink, EmptyState, Stat } from "@/components/ui";
import { fa } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { fullView } from "@/lib/mask";
import type { FullView, OrderStatus } from "@/lib/types";

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

  // Shipper role only ever sees orders where they are the shipper; vehicles of one order stay together.
  const groups = useMemo(() => {
    if (!me) return [];
    const by = new Map<string, FullView[]>();
    for (const o of s.orders) if (o.shipperId === me.id) (by.get(o.groupId) ?? by.set(o.groupId, []).get(o.groupId)!).push(fullView(o, s));
    return [...by.values()].map((g) => g.sort((a, b) => a.groupIndex - b.groupIndex));
  }, [s, me]);

  const matches = (g: FullView[], key: string) => {
    const m = FILTERS.find((x) => x.key === key)!.match;
    return !m.length || g.some((v) => m.includes(v.status));
  };
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((x) => [x.key, groups.filter((g) => matches(g, x.key)).length])), [groups]);
  const shown = groups.filter((g) => matches(g, f));
  const c = (st: OrderStatus[]) => groups.flat().filter((v) => st.includes(v.status)).length;

  return (
    <AppShell area="shipper">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">سلام {me?.name?.split(" ")[0] ?? ""}</h1>
          <p className="mt-1 text-sm text-ink-3">وضعیت سفارش‌های شما به‌صورت زنده به‌روز می‌شود.</p>
        </div>
        <ButtonLink href="/shipper/new/" className="max-sm:hidden!"><Plus className="size-5" />سفارش جدید</ButtonLink>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="در انتظار راننده" value={fa(c(["OPEN", "LOCKED"]))} />
        <Stat label="در جریان" value={fa(c(["ASSIGNED", "IN_TRANSIT"]))} tone="accent" />
        <Stat label="تحویل‌شده" value={fa(c(["DELIVERED"]))} />
      </div>

      <FilterBar>{FILTERS.map((x) => <Chip key={x.key} active={f === x.key} onClick={() => setF(x.key)}>{x.label} ({fa(counts[x.key] ?? 0)})</Chip>)}</FilterBar>

      <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2">
        {!ready ? [0, 1, 2, 3].map((i) => <OrderCardSkeleton key={i} />)
          : shown.map((g, i) =>
            g.length > 1 ? (
              <div key={g[0].groupId} className="sm:col-span-2"><OrderGroupCard items={g} delay={i} /></div>
            ) : (
              <OrderCard key={g[0].id} v={g[0]} delay={i} href={`/shipper/order/?id=${g[0].id}`} footer={g[0].status === "IN_TRANSIT" ? <LiveTempBadge o={g[0]} /> : undefined} />
            ),
          )}
      </div>
      {ready && shown.length === 0 && (
        <EmptyState
          icon={groups.length ? <Truck className="size-7" /> : <PackagePlus className="size-7" />}
          title={groups.length ? "سفارشی در این دسته نیست" : "هنوز سفارشی ثبت نکرده‌اید"}
          body={groups.length ? "فیلتر دیگری را امتحان کنید." : "اولین بار یخچالی‌تان را ثبت کنید؛ رانندگان مناسب بار شما به‌صورت زنده مطلع می‌شوند."}
          action={<ButtonLink href="/shipper/new/">ثبت اولین سفارش</ButtonLink>}
        />
      )}
      <ButtonLink href="/shipper/new/" className="fixed bottom-24 end-4 z-30 size-14 rounded-full px-0 shadow-lift sm:hidden!" aria-label="سفارش جدید"><Plus className="size-6" /></ButtonLink>
    </AppShell>
  );
}
