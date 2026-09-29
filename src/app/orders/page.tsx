"use client";

import { Lock, PackageSearch } from "lucide-react";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/MapView";
import { OrderCard, OrderCardSkeleton } from "@/components/molecules";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { cityByName } from "@/lib/geo";
import { useApp } from "@/lib/hooks";
import { guestView } from "@/lib/mask";

/** Public marketplace teaser: city-level pins only, no detail. */
export default function PublicOrders() {
  const { s, ready } = useApp();
  const list = useMemo(() => s.orders.filter((o) => o.status === "OPEN").map(guestView), [s.orders]);
  const markers = useMemo(() => {
    const byCity = new Map<string, number>();
    list.forEach((v) => byCity.set(v.originCity, (byCity.get(v.originCity) ?? 0) + 1));
    return [...byCity].map(([city, n]) => ({ id: city, lat: cityByName(city).lat, lng: cityByName(city).lng, kind: "order" as const, label: new Intl.NumberFormat("fa-IR").format(n) }));
  }, [list]);

  return (
    <AppShell wide>
      <div className="mb-4">
        <h1 className="text-2xl font-black">بارهای باز</h1>
        <p className="mt-1 text-sm text-ink-3">نمای مهمان فقط شهر و بازه‌ی تقریبی کرایه را نشان می‌دهد.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card className="h-72 overflow-hidden lg:order-2 lg:h-[520px]"><MapView markers={markers} fitKey={String(markers.length)} className="size-full" /></Card>
        <div className="space-y-3">
          <Card className="flex items-center gap-3 bg-brand-50 p-4 shadow-none">
            <Lock className="size-5 shrink-0 text-brand-700" />
            <p className="flex-1 text-sm leading-6">برای دیدن نوع بار، دما، زمان و انتخاب سفارش، وارد شوید.</p>
            <ButtonLink href="/login/?as=driver" size="sm">ورود</ButtonLink>
          </Card>
          {!ready ? [0, 1, 2].map((i) => <OrderCardSkeleton key={i} />)
            : list.length === 0 ? <EmptyState icon={<PackageSearch className="size-7" />} title="فعلاً باری باز نیست" body="چند دقیقه‌ی دیگر سر بزنید." />
            : list.map((v, i) => <OrderCard key={v.id} v={v} delay={i} hideOpenStatus href="/login/?as=driver" />)}
        </div>
      </div>
    </AppShell>
  );
}
