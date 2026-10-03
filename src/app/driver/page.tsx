"use client";

import { CheckCircle2, Filter, Map as MapIcon, PackageSearch, Power, Route, ShieldAlert, Snowflake, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DriverOrderCard } from "@/components/driver/cards";
import { DriverTour, GuestMarket, isLive, StageBanner, Suspended } from "@/components/driver/Stages";
import { MapView } from "@/components/MapView";
import { ProBadge } from "@/components/brand";
import { AcceptSheet } from "@/components/rules";
import { toast } from "@/components/Toaster";
import { Button, Card, EmptyState, Sheet, Skeleton, Tabs, Field, Input, Textarea, NumInput, Badge, ButtonLink, Select } from "@/components/ui";
import { PlaceCombobox } from "@/components/inputs";
import { JalaliDateTimePicker } from "@/components/pickers";
import { claimBlock, eligibility, STAGE_LABEL, suspensionOf } from "@/lib/engine/drivers";
import { declareTrip, resumeKycAfterReject } from "@/lib/engine/kyc";
import { driverNetFor } from "@/lib/engine/pay";
import { needsAcceptance, submitAppeal } from "@/lib/engine/trust";
import { driverStats } from "@/lib/engine/stats";
import { cityPlace, roadKm } from "@/lib/geo";
import { fa, jDateTime, toman, TEMP_PRESETS } from "@/lib/format";
import { useNow, usePortal } from "@/lib/hooks";
import { viewOrder, isPublic, isFull } from "@/lib/mask";
import { matchVehicle } from "@/lib/matching";
import { act } from "@/lib/store";
import type { CargoKind, Order, PublicView } from "@/lib/types";

type Mode = "list" | "map";
type Sort = "near" | "price" | "soon";
const DAY = 86_400_000;
const tempKind = (v: PublicView) => (v.cargoMode === "AMBIENT" || v.tempMax === undefined ? "ambient" : v.tempMax <= -18 ? "frozen" : (v.tempMin ?? 0) >= 8 ? "cool" : "chilled");

export default function Page() {
  const { s, me, driver, stage, ready } = usePortal("driver");
  const [tourOpen, setTourOpen] = useState(true);
  if (!ready) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (!me) return <GuestMarket />;
  if (stage === "suspended") return <Suspended pid={me.id} />;
  if (!me.tourDone && tourOpen && (!driver || stage === "not_started")) return <DriverTour pid={me.id} onDone={() => setTourOpen(false)} />;
  void s;
  return <Market />;
}

function Market() {
  const { s, me, driver, stage } = usePortal("driver");
  const now = useNow(1000);
  const [mode, setMode] = useState<Mode>("list");
  const [sort, setSort] = useState<Sort>("near");
  const [tab, setTab] = useState<"all" | "backhaul" | "direct">("all");
  const [sheet, setSheet] = useState(false);
  const [trip, setTrip] = useState(false);
  const [f, setF] = useState<{ temp: "" | "frozen" | "chilled" | "cool" | "ambient"; cargo: "" | CargoKind; near: boolean; proOnly: boolean; minNet?: number; day: "" | "today" | "tomorrow" }>({ temp: "", cargo: "", near: false, proOnly: false, day: "" });
  const [accept, setAccept] = useState(false);
  const d = driver ?? undefined;
  const live = isLive(stage);
  const from = d?.lastLoc ?? cityPlace("تهران");
  const block = claimBlock(s, d);
  const lock = s.orders.find((o) => o.status === "LOCKED" && o.lockedBy === me!.id);
  const active = s.orders.filter((o) => o.driverId === me!.id && ["AWAITING_DEPOSIT", "ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "MISMATCH_REVIEW", "IN_TRANSIT", "AT_DELIVERY"].includes(o.status));
  const activeTrip = d?.declaredTrips.find((t) => t.active);

  const rows = useMemo(() => {
    const out: { o: Order; v: PublicView; net: number; fit: { ok: boolean; why?: string }; dead: number }[] = [];
    for (const o of s.orders) {
      if (!(o.status === "OPEN" || o.status === "PRO_POOL" || (o.status === "DIRECT_REQUESTED" && o.directDriverId === me!.id))) continue;
      const v = viewOrder(o, s, me!.id);
      if (!isPublic(v) && !isFull(v)) continue;
      const pv = v as PublicView;
      const e: { ok: boolean; why: string } = d && live ? { why: "", ...eligibility(s, d, o) } : { ok: true, why: "" };
      if (!e.ok && /پرو|دیگری|حساب شما/.test(e.why) && !pv.isDirectToMe) continue; // invisible, not just unfit
      out.push({ o, v: pv, net: driverNetFor(s, o).net, fit: e.ok ? { ok: true } : { ok: false, why: e.why }, dead: roadKm(from, pv.originArea) });
    }
    return out;
  }, [s, d, me, from, live]);

  const list = rows.filter((r) => {
    if (tab === "direct" && !r.v.isDirectToMe) return false;
    if (tab === "backhaul" && !(activeTrip && r.v.originCity === activeTrip.to && r.v.destCity === activeTrip.backTo)) return false;
    if (f.temp && tempKind(r.v) !== f.temp) return false;
    if (f.cargo && r.v.cargo !== f.cargo) return false;
    if (f.near && r.dead > 100) return false;
    if (f.proOnly && r.v.serviceClass !== "PRO") return false;
    if (f.minNet && r.net < f.minNet * 10) return false;
    if (f.day === "today" && r.v.pickupAt > now + DAY / 1.5) return false;
    if (f.day === "tomorrow" && (r.v.pickupAt < now + DAY / 3 || r.v.pickupAt > now + 2 * DAY)) return false;
    return true;
  }).sort((a, b) => (a.fit.ok === b.fit.ok ? 0 : a.fit.ok ? -1 : 1) || (sort === "near" ? a.dead - b.dead : sort === "price" ? b.net - a.net : a.v.pickupAt - b.v.pickupAt));
  const hidden = rows.filter((r) => !r.fit.ok).length;
  const st = driverStats(s, me!.id);
  const nf = Object.values(f).filter(Boolean).length;
  void stage;

  return (
    <div className="space-y-4">
      {live && d ? (<Card className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0"><div className="flex items-center gap-2 font-black">{me!.name}{d.pro.status === "pro" && <ProBadge />}</div><div className="text-xs text-ink-3">{fa(st.trips)} سفر · امتیاز {fa(Math.round(st.rating * 10) / 10)}</div></div>
        <button role="switch" aria-checked={d.online} onClick={() => act((x) => { const dd = x.drivers.find((q) => q.personId === me!.id); if (dd) dd.online = !dd.online; })} className={`flex h-12 items-center gap-2 rounded-full px-4 font-bold ${d.online ? "bg-ok text-white" : "bg-surface-3 text-ink-2"}`}><Power className="size-4" aria-hidden />{d.online ? "آنلاین" : "آفلاین"}</button>
      </Card>) : <StageBanner stage={stage ?? "not_started"} pid={me!.id} />}

      {live && me && needsAcceptance(s, me.id, "driver") && <Card className="flex flex-wrap items-center justify-between gap-3 border border-warn/30 bg-warn-bg p-4"><span className="font-bold text-warn">نسخه‌ی جدید قوانین منتشر شده؛ برای ادامه باید بپذیرید.</span><Button size="sm" onClick={() => setAccept(true)}>مطالعه و پذیرش</Button></Card>}
      {stage === "pro_invited" && <Card className="p-4"><div className="flex items-center justify-between gap-3"><span className="font-bold">به جمع رانندگان کامیونت پرو دعوت شده‌اید.</span><ButtonLink href="/driver/profile/" size="sm">مشاهده</ButtonLink></div></Card>}
      {block && <Card className="border border-warn/30 bg-warn-bg p-4 text-sm font-bold text-warn">{block}</Card>}
      {lock && <Link href={`/driver/order/?id=${lock.id}`} className="block"><Card className="border-2 border-brand-500 p-4 font-bold">یک بار در انتظار تأیید نهایی شماست؛ برای ادامه بزنید.</Card></Link>}
      {active.map((o) => <Link key={o.id} href={`/driver/trip/?id=${o.id}`} className="block"><Card className="flex items-center justify-between gap-3 border-2 border-act p-4"><span className="font-black">سفر جاری: {o.origin.city} ← {o.dest.city}</span><Badge tone="info">ادامه</Badge></Card></Link>)}

      <div className="flex items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "all", label: "همه‌ی بارها", count: rows.length }, { id: "backhaul", label: "برگشتی" }, { id: "direct", label: "درخواست مستقیم", count: rows.filter((r) => r.v.isDirectToMe).length }]} className="flex-1" />
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setSheet(true)}><Filter className="size-4" aria-hidden />فیلتر{nf ? ` (${fa(nf)})` : ""}</Button>
        <Select aria-label="مرتب‌سازی" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-11 w-40 shrink-0"><option value="near">نزدیک‌ترین</option><option value="price">بیشترین درآمد</option><option value="soon">زودترین بارگیری</option></Select>
        {live && <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setTrip(true)}><Route className="size-4" aria-hidden />سفر من</Button>}
        <Button variant="ghost" size="sm" aria-pressed={mode === "map"} onClick={() => setMode(mode === "map" ? "list" : "map")} className="ms-auto shrink-0"><MapIcon className="size-4" aria-hidden />{mode === "map" ? "فهرست" : "نقشه"}</Button>
      </div>
      {activeTrip && <p className="rounded-ui bg-act-soft p-3 text-sm font-medium">سفر اعلام‌شده: {activeTrip.from} ← {activeTrip.to}، بازگشت به {activeTrip.backTo} · تب «برگشتی» بارهای هم‌مسیر شما را نشان می‌دهد.</p>}

      {mode === "map" ? (
        <Card className="overflow-hidden"><MapView className="h-[60dvh]" cluster markers={list.map((r) => ({ id: r.o.id, lat: r.v.originArea.lat, lng: r.v.originArea.lng, kind: "order" as const, label: `${fa(Math.round(r.net / 10_000) / 100)}م` }))} fitKey={`${list.length}`} onMarkerClick={(id) => { window.location.href = `/driver/order/?id=${id}`; }} /></Card>
      ) : list.length === 0 ? (
        <EmptyState icon={<PackageSearch className="size-8" />} title="باری با این فیلترها پیدا نشد" body="فیلترها را کم کنید یا سفر خود را اعلام کنید تا بارهای هم‌مسیر را ببینید." action={nf ? <Button onClick={() => { setF({ temp: "", cargo: "", near: false, proOnly: false, day: "" }); setTab("all"); }}>پاک کردن فیلترها</Button> : <Button onClick={() => setTrip(true)}>اعلام سفر</Button>} />
      ) : (
        <div className="space-y-3">{list.map((r) => <DriverOrderCard key={r.o.id} v={r.v} o={r.o} net={r.net} from={from} fit={r.fit} href={`/driver/order/?id=${r.o.id}`} />)}</div>
      )}
      {hidden > 0 && <p className="text-center text-xs text-ink-3">{fa(hidden)} بار با ویژگی‌های خودروی شما نمی‌خواند و کم‌رنگ نمایش داده شده است.</p>}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="فیلتر بارها" footer={<div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setF({ temp: "", cargo: "", near: false, proOnly: false, day: "" })}>پاک کردن</Button><Button onClick={() => setSheet(false)}>نمایش {fa(list.length)} بار</Button></div>}>
        <div className="space-y-5">
          <Field label="دما">{(id) => <Select id={id} value={f.temp} onChange={(e) => setF({ ...f, temp: e.target.value as typeof f.temp })}><option value="">همه</option><option value="frozen">{TEMP_PRESETS.frozen.label}</option><option value="chilled">سردخانه‌ای</option><option value="cool">خنک</option><option value="ambient">غیریخچالی</option></Select>}</Field>
          <Field label="نوع بار">{(id) => <Select id={id} value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value as typeof f.cargo })}><option value="">همه</option>{(["dairy", "meat", "fish", "produce", "icecream", "pharma", "dry"] as CargoKind[]).map((k) => <option key={k} value={k}>{({ dairy: "لبنیات", meat: "گوشت", fish: "ماهی", produce: "میوه و سبزی", icecream: "بستنی", pharma: "دارو", dry: "خشک‌بار" } as Record<string, string>)[k]}</option>)}</Select>}</Field>
          <Field label="زمان بارگیری">{(id) => <Select id={id} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value as typeof f.day })}><option value="">هر زمان</option><option value="today">امروز</option><option value="tomorrow">فردا</option></Select>}</Field>
          <Field label="حداقل درآمد خالص (تومان)">{(id) => <NumInput id={id} value={f.minNet} onChange={(v) => setF({ ...f, minNet: v })} suffix="تومان" />}</Field>
          {([["near", "نزدیک من (تا ۱۰۰ کیلومتر)"], ["proOnly", "فقط بارهای پرو"]] as const).map(([k, l]) => <label key={k} className="flex min-h-12 items-center gap-3"><input type="checkbox" className="size-5" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{l}</label>)}
        </div>
      </Sheet>
      <TripSheet open={trip} onClose={() => setTrip(false)} pid={me!.id} />
      {me && <AcceptSheet open={accept} onClose={() => setAccept(false)} personId={me.id} audience="driver" />}
    </div>
  );
}

function TripSheet({ open, onClose, pid }: { open: boolean; onClose: () => void; pid: string }) {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [back, setBack] = useState("");
  const [at, setAt] = useState(Date.now() + 6 * 3_600_000);
  return (
    <Sheet open={open} onClose={onClose} title="اعلام سفر / مسیر برگشت" footer={<Button block disabled={!a || !b || !back} onClick={() => { const r = act((s) => declareTrip(s, pid, { from: a, to: b, departAt: at, backTo: back })); toast(r.ok ? "سفر ثبت شد؛ بارهای هم‌مسیر را در تب «برگشتی» ببینید." : r.error, r.ok ? "ok" : "err"); if (r.ok) onClose(); }}>ثبت سفر</Button>}>
      <div className="space-y-4"><p className="text-sm leading-7 text-ink-3">مسیری که می‌روید و مقصدی که بعد از تخلیه می‌خواهید برگردید را بگویید تا بارهای برگشتی مناسب نشان داده شود.</p>
        <PlaceCombobox label="از" value={a} onSelect={(p) => setA(p?.name ?? "")} /><PlaceCombobox label="به" value={b} onSelect={(p) => setB(p?.name ?? "")} /><PlaceCombobox label="مقصد بعد از تخلیه (مثلاً خانه)" value={back} onSelect={(p) => setBack(p?.name ?? "")} />
        <JalaliDateTimePicker label="زمان حرکت" value={at} onChange={setAt} min={Date.now()} /></div>
    </Sheet>
  );
}
void CheckCircle2; void Snowflake; void Truck; void Input; void jDateTime; void toman; void matchVehicle;
