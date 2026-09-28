"use client";

import { List, Map as MapIcon, PackageSearch } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DriverBanner } from "@/components/DriverBanner";
import { MapView } from "@/components/MapView";
import { Chip, FilterBar, OrderCard, OrderCardSkeleton, VerificationBadge, CargoLabel } from "@/components/molecules";
import { Card, EmptyState, cx } from "@/components/ui";
import { CARGO, fa } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { canCarry } from "@/lib/matching";
import { publicView } from "@/lib/mask";
import { driverNet } from "@/lib/pricing";
import type { CargoType, PublicView } from "@/lib/types";

type Sort = "new" | "price" | "km" | "date";

export default function DriverMarket() {
  const { s, me, driver, standing, ready } = useApp();
  const [view, setView] = useState<"map" | "list">("map");
  const [cargo, setCargo] = useState<CargoType | "all">("all");
  const [sort, setSort] = useState<Sort>("new");
  const [sel, setSel] = useState<string | null>(null);

  const hasVehicle = !!driver?.vehicle.plate;
  const items = useMemo(() => {
    if (!me) return [];
    const list = s.orders
      // A user acting as driver never sees orders they placed as a shipper.
      .filter((o) => o.shipperId !== me.id)
      .filter((o) => o.status === "OPEN" || (o.status === "LOCKED" && o.lockedBy === me.id))
      .filter((o) => !hasVehicle || canCarry(driver!.vehicle.minTemp, o.tempMax))
      .filter((o) => cargo === "all" || o.cargo === cargo)
      .map((o) => ({ v: publicView(o, me.id), created: o.createdAt }));
    const by: Record<Sort, (a: { v: PublicView; created: number }, b: { v: PublicView; created: number }) => number> = {
      new: (a, b) => b.created - a.created,
      price: (a, b) => b.v.price - a.v.price,
      km: (a, b) => a.v.distanceKm - b.v.distanceKm,
      date: (a, b) => a.v.pickupAt - b.v.pickupAt,
    };
    return list.sort(by[sort]).map((x) => x.v);
  }, [s.orders, me, driver, hasVehicle, cargo, sort]);

  const markers = useMemo(() => items.map((v) => ({ id: v.id, lat: v.originArea.lat, lng: v.originArea.lng, kind: "order" as const, label: `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(driverNet(v.price, s.config) / 1e6)} م`, selected: v.id === sel })), [items, sel, s.config]);
  const selected = items.find((v) => v.id === sel);
  const circles = useMemo(() => (selected ? [
    { id: "a", lat: selected.originArea.lat, lng: selected.originArea.lng, radius: selected.originArea.radius, tone: "brand" as const },
    { id: "b", lat: selected.destArea.lat, lng: selected.destArea.lng, radius: selected.destArea.radius, tone: "accent" as const },
  ] : []), [selected]);
  const lines = useMemo(() => (selected ? [{ id: "l", points: [[selected.originArea.lat, selected.originArea.lng], [selected.destArea.lat, selected.destArea.lng]] as [number, number][], dashed: true }] : []), [selected]);

  return (
    <AppShell area="driver" wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">بازار بار</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-3">
            {hasVehicle ? <>بارهای سازگار با یخچال خودروی شما · {fa(items.length)} مورد</> : <>همه‌ی بارهای باز · {fa(items.length)} مورد</>}
            <VerificationBadge standing={standing} />
          </p>
        </div>
        <div className="flex rounded-full bg-white p-1 shadow-soft" role="tablist">
          {([["map", "نقشه", MapIcon], ["list", "لیست", List]] as const).map(([k, l, I]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className={cx("flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition", view === k ? "bg-ink text-white" : "text-ink-3")}><I className="size-4" />{l}</button>
          ))}
        </div>
      </div>

      <DriverBanner />

      <FilterBar>
        <Chip active={cargo === "all"} onClick={() => setCargo("all")}>همه‌ی بارها</Chip>
        {(Object.keys(CARGO) as CargoType[]).map((k) => <Chip key={k} active={cargo === k} onClick={() => setCargo(k)}><CargoLabel type={k} /></Chip>)}
      </FilterBar>

      <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-sm">
        <span className="text-ink-3">مرتب‌سازی:</span>
        {([["new", "جدیدترین"], ["price", "بیشترین کرایه"], ["km", "کمترین مسافت"], ["date", "نزدیک‌ترین زمان"]] as [Sort, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={cx("rounded-full px-3 py-1 transition", sort === k ? "bg-brand-100 font-bold" : "text-ink-3 hover:bg-surface-3")}>{l}</button>
        ))}
      </div>

      {view === "map" ? (
        <div className="relative mt-4 h-[calc(100dvh-25rem)] min-h-96 overflow-hidden rounded-ui shadow-soft">
          {ready ? <MapView markers={markers} circles={circles} lines={lines} onMarkerClick={setSel} onMapClick={() => setSel(null)} fitKey={ready ? "m" : ""} className="size-full" /> : <div className="skeleton size-full" />}
          {items.length === 0 && ready && <div className="absolute inset-x-4 top-4 z-[500]"><Card className="p-4 text-center text-sm text-ink-3">فعلاً باز مناسبی نیست. سفارش جدید که ثبت شود، همین‌جا زنده ظاهر می‌شود.</Card></div>}
          {selected && (
            <div className="absolute inset-x-3 bottom-3 z-[500] animate-rise sm:inset-x-auto sm:end-3 sm:w-96">
              <OrderCard v={selected} net={driverNet(selected.price, s.config)} href={`/driver/order/?id=${selected.id}`} />
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {!ready ? [0, 1, 2, 3].map((i) => <OrderCardSkeleton key={i} />) : items.map((v, i) => <OrderCard key={v.id} v={v} delay={i} net={driverNet(v.price, s.config)} href={`/driver/order/?id=${v.id}`} />)}
        </div>
      )}
      {view === "list" && ready && items.length === 0 && (
        <EmptyState icon={<PackageSearch className="size-7" />} title="باری مطابق فیلترها پیدا نشد" body="فیلتر را تغییر دهید یا چند لحظه صبر کنید؛ بارهای جدید زنده اضافه می‌شوند." />
      )}
      <p className="mt-3 text-xs text-ink-3">قیمت‌ها «سهم شما» بعد از کسر {fa(s.config.commission * 100)}٪ کارمزد کامیونت است. موقعیت نقشه، محدوده‌ی تقریبی است.</p>
    </AppShell>
  );
}
