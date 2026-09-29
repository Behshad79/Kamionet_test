"use client";

import { Crosshair, List, Map as MapIcon, MapPin, PackageSearch, SlidersHorizontal, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DriverBanner } from "@/components/DriverBanner";
import { PlaceCombobox } from "@/components/inputs";
import { MapView } from "@/components/MapView";
import { Chip, FilterBar, OrderCard, OrderCardSkeleton, VerificationBadge } from "@/components/molecules";
import { toast } from "@/components/Toaster";
import { Card, EmptyState, cx } from "@/components/ui";
import { CARGO, fa, tomanWords } from "@/lib/format";
import { haversine, nearestCity } from "@/lib/geo";
import { useApp } from "@/lib/hooks";
import { publicView } from "@/lib/mask";
import { matchVehicle } from "@/lib/matching";
import { driverNet } from "@/lib/pricing";
import { placeByName, type GazPlace } from "@/lib/places";
import type { CargoType, PublicView } from "@/lib/types";

type Sort = "near" | "new" | "price" | "date";
const RADII = [50, 100, 200, 400, 0] as const;
const LOC_KEY = "kamionet:driver-loc";
const DEST_NEAR_KM = 80;

export default function DriverMarket() {
  const { s, me, driver, standing, ready } = useApp();
  // The list is the default: the driver's real question is "what fits my route from where I am".
  const [view, setView] = useState<"list" | "map">("list");
  const [cargo, setCargo] = useState<CargoType | "all">("all");
  const [sort, setSort] = useState<Sort>("near");
  const [sel, setSel] = useState<string | null>(null);
  const [here, setHere] = useState<GazPlace | null>(null);
  const [dest, setDest] = useState<GazPlace | null>(null);
  const [radius, setRadius] = useState<number>(200);
  const [panel, setPanel] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOC_KEY);
      const p = saved ? placeByName(saved) : undefined;
      if (p) setHere(p);
    } catch { /* ignore */ }
  }, []);
  const setLocation = (p: GazPlace | null) => {
    setHere(p);
    try { if (p) localStorage.setItem(LOC_KEY, p.name); else localStorage.removeItem(LOC_KEY); } catch { /* ignore */ }
  };
  const useGps = () => {
    if (!navigator.geolocation) return toast("مرورگر شما موقعیت‌یابی را پشتیبانی نمی‌کند.", "err");
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c = nearestCity(pos.coords.latitude, pos.coords.longitude); setLocation(c); toast(`موقعیت شما نزدیک «${c.name}» ثبت شد`, "info"); },
      () => toast("دسترسی به موقعیت داده نشد؛ شهر را دستی انتخاب کنید.", "err"),
      { timeout: 6000 },
    );
  };

  const hasVehicle = !!driver?.vehicle.plate;

  const items = useMemo(() => {
    if (!me) return [];
    const km = (v: PublicView) => (here ? Math.round(haversine(here.lat, here.lng, v.originArea.lat, v.originArea.lng)) : undefined);
    const list = s.orders
      // A user acting as driver never sees orders they placed as a shipper.
      .filter((o) => o.shipperId !== me.id)
      .filter((o) => o.status === "OPEN" || (o.status === "LOCKED" && o.lockedBy === me.id))
      // Match on type + payload + fridge, never temperature alone.
      .filter((o) => !hasVehicle || matchVehicle(driver!.vehicle, o).ok)
      .filter((o) => cargo === "all" || o.cargo === cargo)
      .map((o) => publicView(o, me.id, s.ratings));
    const withKm = list.map((v) => ({ v, d: km(v) }));
    const near = withKm.filter(({ d }) => !here || radius === 0 || (d ?? 0) <= radius);
    const toDest = near.filter(({ v }) => !dest || v.destCity === dest.name || haversine(dest.lat, dest.lng, v.destArea.lat, v.destArea.lng) <= DEST_NEAR_KM);
    type Row = (typeof toDest)[number];
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      near: (a, b) => (a.d ?? 0) - (b.d ?? 0),
      new: (a, b) => b.v.pickupAt - a.v.pickupAt,
      price: (a, b) => b.v.price - a.v.price,
      date: (a, b) => a.v.pickupAt - b.v.pickupAt,
    };
    return toDest.sort(sort === "near" && !here ? by.date : by[sort]);
  }, [s.orders, s.ratings, me, driver, hasVehicle, cargo, sort, here, dest, radius]);

  const markers = useMemo(
    () => [
      ...items.map(({ v }) => ({ id: v.id, lat: v.originArea.lat, lng: v.originArea.lng, kind: "order" as const, label: tomanWords(driverNet(v.price, s.config)), selected: v.id === sel })),
      ...(here ? [{ id: "me", lat: here.lat, lng: here.lng, kind: "dot" as const }] : []),
    ],
    [items, sel, s.config, here],
  );
  const selected = items.find(({ v }) => v.id === sel);
  const circles = useMemo(() => (selected ? [
    { id: "a", lat: selected.v.originArea.lat, lng: selected.v.originArea.lng, radius: selected.v.originArea.radius, tone: "brand" as const },
    { id: "b", lat: selected.v.destArea.lat, lng: selected.v.destArea.lng, radius: selected.v.destArea.radius, tone: "accent" as const },
  ] : []), [selected]);
  const lines = useMemo(() => (selected ? [{ id: "l", points: [[selected.v.originArea.lat, selected.v.originArea.lng], [selected.v.destArea.lat, selected.v.destArea.lng]] as [number, number][], dashed: true }] : []), [selected]);

  const card = (x: { v: PublicView; d: number | undefined }, i: number) => (
    <OrderCard key={x.v.id} v={x.v} delay={i} hideOpenStatus net={driverNet(x.v.price, s.config)} href={`/driver/order/?id=${x.v.id}`}
      extra={x.d !== undefined ? <div className="text-xs font-bold text-ink-2">{fa(x.d)} کیلومتر تا مبدأ بار</div> : undefined} />
  );

  return (
    <AppShell area="driver" wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">بازار بار</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            {hasVehicle ? "بارهای سازگار با نوع، ظرفیت و یخچال خودروی شما" : "همه‌ی بارهای باز"} · {fa(items.length)} مورد
            <VerificationBadge standing={standing} />
          </p>
        </div>
        <div className="flex rounded-full bg-white p-1 shadow-soft" role="tablist" aria-label="نحوه‌ی نمایش">
          {([["list", "لیست", List], ["map", "نقشه", MapIcon]] as const).map(([k, l, I]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className={cx("flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition", view === k ? "bg-ink text-white" : "text-ink-3")}><I className="size-4" aria-hidden />{l}</button>
          ))}
        </div>
      </div>

      <DriverBanner />

      {/* The two questions a driver actually asks: where am I, and where do I want to end up. */}
      {(() => {
        const open = panel ?? !here; // no location yet → the panel invites setting one
        return (
          <Card className="mb-3 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <MapPin className="size-4 shrink-0 text-accent-600" aria-hidden />
                <span className="min-w-0 truncate">
                  {here ? <><b>{here.name}</b>{radius ? ` · تا ${fa(radius)} کیلومتر` : " · بدون محدودیت فاصله"}</> : <span className="text-ink-3">محل فعلی‌تان را تعیین کنید</span>}
                  {dest && <> · برگشت به <b>{dest.name}</b></>}
                </span>
              </div>
              <button type="button" aria-expanded={open} onClick={() => setPanel(!open)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-accent-600 hover:bg-accent-50">
                <SlidersHorizontal className="size-4" aria-hidden />{open ? "بستن فیلترها" : "ویرایش موقعیت و مقصد"}
              </button>
            </div>
            {open && (
              <div className="mt-3 animate-rise space-y-4 border-t border-line pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <PlaceCombobox label="محل فعلی من (نزدیک مبدأ بار)" value={here?.name} onSelect={setLocation} allowClear placeholder="شهر فعلی خود را انتخاب کنید" />
                    <button type="button" onClick={useGps} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-accent-600 hover:bg-accent-50"><Crosshair className="size-4" aria-hidden />استفاده از موقعیت GPS</button>
                  </div>
                  <PlaceCombobox label="مقصد دلخواه (بار برگشتی)" value={dest?.name} onSelect={setDest} allowClear placeholder="مثلاً به سمت مشهد برمی‌گردم" />
                </div>
                {here && (
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="شعاع فاصله از محل من">
                    <span className="text-sm text-ink-3">فاصله‌ی مبدأ بار تا من:</span>
                    {RADII.map((r) => <Chip key={r} active={radius === r} onClick={() => setRadius(r)}>{r === 0 ? "بدون محدودیت" : `تا ${fa(r)} کیلومتر`}</Chip>)}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })()}
      <p className="mb-3 flex items-start gap-2 text-[13px] leading-6 text-ink-2"><Zap className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />با انتخاب هر بار، همان لحظه برای شما رزرو می‌شود؛ بدون تأیید صاحب بار و بدون چانه‌زنی. اولین راننده برنده است.</p>

      <FilterBar>
        <Chip active={cargo === "all"} onClick={() => setCargo("all")}>همه‌ی بارها</Chip>
        {(Object.keys(CARGO) as CargoType[]).map((k) => <Chip key={k} active={cargo === k} onClick={() => setCargo(k)}>{CARGO[k].label}</Chip>)}
      </FilterBar>

      <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-sm">
        <span className="text-ink-3">مرتب‌سازی:</span>
        {([["near", "نزدیک‌ترین به من"], ["new", "دیرترین بارگیری"], ["price", "بیشترین کرایه"], ["date", "نزدیک‌ترین زمان"]] as [Sort, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} aria-pressed={sort === k} disabled={k === "near" && !here}
            className={cx("min-h-11 rounded-full px-3 transition disabled:opacity-40", sort === k ? "bg-brand-100 font-bold" : "text-ink-3 hover:bg-surface-3")}>{l}</button>
        ))}
      </div>

      {view === "map" ? (
        <div className="relative mt-4 h-[calc(100dvh-14rem)] min-h-[26rem] overflow-hidden rounded-ui shadow-soft">
          <MapView markers={markers} circles={circles} lines={lines} cluster onMarkerClick={(id) => id !== "me" && setSel(id)} onMapClick={() => setSel(null)} fitKey={`${ready}:${here?.name ?? ""}:${items.length > 0}`} className="size-full" />
          {items.length === 0 && ready && <div className="absolute inset-x-4 top-16 z-[500]"><Card className="p-4 text-center text-sm text-ink-3">با این فیلترها باری نیست. فیلتر را باز کنید یا منتظر بار جدید بمانید.</Card></div>}
          {selected && (
            <div className="absolute inset-x-3 bottom-3 z-[500] animate-rise sm:inset-x-auto sm:end-3 sm:w-[26rem]">
              {card(selected, 0)}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {!ready ? [0, 1, 2].map((i) => <OrderCardSkeleton key={i} />) : items.map(card)}
        </div>
      )}
      {view === "list" && ready && items.length === 0 && (
        <EmptyState icon={<PackageSearch className="size-7" />} title="باری مطابق فیلترها پیدا نشد"
          body={here || dest ? "شعاع را بیشتر کنید یا مقصد دلخواه را بردارید؛ بارهای جدید زنده اضافه می‌شوند." : "فیلتر را تغییر دهید یا چند لحظه صبر کنید؛ بارهای جدید زنده اضافه می‌شوند."} />
      )}
      <p className="mt-3 text-xs text-ink-3">مبلغ هر کارت «سهم خالص شما» پس از کارمزد {fa(s.config.commission * 100)}٪ پلتفرم است. موقعیت روی نقشه محدوده‌ی تقریبی است.</p>
    </AppShell>
  );
}
