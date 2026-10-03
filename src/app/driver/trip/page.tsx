"use client";

import { AlertTriangle, CheckCircle2, ChevronLeft, Clock, LifeBuoy, MapPinned, Phone, Siren, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TruckIllustration } from "@/components/graphics/TruckIllustration";
import { MapView } from "@/components/MapView";
import { CargoLabel, FileDrop, RouteLine, StatusBadge, TempChip, type Captured } from "@/components/molecules";
import { PriceBreakdown, StatusTimeline } from "@/components/order/parts";
import { MismatchPanel, MismatchSheet } from "@/components/mismatch";
import { ReviewForm } from "@/components/ReviewForm";
import { TempPanel } from "@/components/TempPanel";
import { toast } from "@/components/Toaster";
import { Accordion, Button, Card, EmptyState, Field, Input, NumInput, Sheet, Skeleton, Textarea } from "@/components/ui";
import { cancelByDriver, arriveDelivery, arrivePickup, reportShipperNotReady, startToPickup, waitFeeFor } from "@/lib/engine/orders";
import { openTicket, myReview } from "@/lib/engine/trust";
import { commissionRate, driverNetFor } from "@/lib/engine/pay";
import { person } from "@/lib/engine/core";
import { cv } from "@/lib/config";
import { fa, jDateTime, mmss, toman, weightLabel } from "@/lib/format";
import { lerp } from "@/lib/geo";
import { useNow, usePortal, useQueryId } from "@/lib/hooks";
import { isFull, viewOrder } from "@/lib/mask";
import { act } from "@/lib/store";
import { telemetryOf, tripProgress } from "@/lib/telemetry";
import { submitJob, useQueueCount, flushQueue } from "@/lib/uploadQueue";
import { R } from "@/lib/money";
import type { Media } from "@/lib/types";

const asMedia = (c: Captured, kind: Media["kind"], items?: number): Media => ({ kind, dataUrl: c.dataUrl, takenAt: c.takenAt, lat: c.lat, lng: c.lng, items });

export default function Page() {
  const id = useQueryId();
  const { s, me, driver, ready } = usePortal("driver");
  const now = useNow(1000);
  const queued = useQueueCount();
  const [cargo, setCargo] = useState<Captured>();
  const [inv, setInv] = useState<Captured>();
  const [items, setItems] = useState<number | undefined>();
  const [otp, setOtp] = useState("");
  const [cash, setCash] = useState<number | undefined>();
  const [sos, setSos] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [mm, setMm] = useState(false);
  const [busy, setBusy] = useState(false);
  const o = s.orders.find((x) => x.id === id);
  const v = o && me ? viewOrder(o, s, me.id) : undefined;
  useEffect(() => { const h = () => { const f = flushQueue(); f.forEach((x) => toast(x.error, "err")); }; window.addEventListener("online", h); return () => window.removeEventListener("online", h); }, []);
  const tel = o ? telemetryOf(o) : undefined;
  const pos = useMemo(() => (o ? lerp(o.origin, o.dest, tripProgress(telemetryOf(o), now)) : undefined), [o, now]);
  if (id === undefined || !ready) return <Skeleton className="h-64" />;
  if (!o || !me || !driver || o.driverId !== me.id || !v || !isFull(v)) return <EmptyState icon={<AlertTriangle className="size-8" />} title="سفر پیدا نشد" action={<Link href="/driver/trips/" className="font-bold text-accent-600">سفرهای من</Link>} />;
  const shipper = person(s, o.shipperId);
  const net = driverNetFor(s, o);
  const nav = (p: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  const run = (fn: () => { ok: boolean; error?: string }, msg: string) => { const r = fn(); toast(r.ok ? msg : r.error ?? "انجام نشد", r.ok ? "ok" : "err"); return r; };
  const wait = o.arrivedPickupAt && o.status === "AT_PICKUP" ? now - o.arrivedPickupAt : 0;
  const freeMs = cv<number>(s, "waiting.freeMin") * 60_000;
  const submit = async (j: Parameters<typeof submitJob>[0], okMsg: string) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 400));
    const r = submitJob(j);
    setBusy(false);
    if (r.queued) return toast("اینترنت قطع است؛ اطلاعات در صف ارسال ماند و با اتصال ارسال می‌شود.", "info");
    toast(r.result!.ok ? okMsg : (r.result as { error: string }).error, r.result!.ok ? "ok" : "err");
  };
  const q = queued > 0;

  return (
    <div className="space-y-4 pb-32">
      <div className="flex items-center justify-between"><Link href="/driver/trips/" className="inline-flex h-11 items-center gap-1 text-sm font-medium text-accent-600"><ChevronLeft className="size-4 rotate-180" aria-hidden />سفرهای من</Link>
        <button onClick={() => setSos(true)} className="inline-flex h-12 items-center gap-2 rounded-full bg-danger px-4 font-black text-white"><Siren className="size-5" aria-hidden />SOS</button></div>
      {q && <div role="status" className="flex items-center gap-2 rounded-ui bg-warn-bg p-3 text-sm font-bold text-warn"><WifiOff className="size-4" aria-hidden />{fa(queued)} مورد در صف ارسال است</div>}
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-black">{o.origin.city} ← {o.dest.city}</h1><StatusBadge status={o.status} /></div>

      <Card className="space-y-3 p-4">
        <TruckIllustration kind={driver.vehicle.kind} color={driver.vehicle.color} state={o.status === "IN_TRANSIT" ? "driving" : "cooling"} className="h-16 w-full" />
        <RouteLine from={o.origin.city} to={o.dest.city} sub={[v.origin.address || "—", v.dest.address || "—"]} />
        <div className="flex flex-wrap items-center gap-2 text-sm"><CargoLabel type={o.cargo} />{o.tempMin !== undefined && o.tempMax !== undefined && <TempChip min={o.tempMin} max={o.tempMax} />}<span className="text-ink-3">{weightLabel(o.weightKg)}</span></div>
        {shipper && <a href={`tel:${shipper.phone}`} className="inline-flex h-12 w-full items-center justify-between rounded-ui bg-surface-3 px-4 font-bold"><span>{shipper.name}</span><span className="flex items-center gap-2" dir="ltr"><Phone className="size-4" aria-hidden />{shipper.phone}</span></a>}
        {o.note && <p className="rounded-ui bg-surface-2 p-3 text-sm">{o.note}</p>}
      </Card>

      {["ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "MISMATCH_REVIEW"].includes(o.status) && (
        <Card className="overflow-hidden">
          <MapView className="h-52" fitKey={o.id} markers={[{ id: "o", lat: o.origin.lat, lng: o.origin.lng, kind: "origin" }, { id: "d", lat: o.dest.lat, lng: o.dest.lng, kind: "dest" }]} lines={[{ id: "l", points: [[o.origin.lat, o.origin.lng], [o.dest.lat, o.dest.lng]], dashed: true, tone: "accent" }]} />
          <div className="grid grid-cols-2 gap-px bg-line text-sm"><a href={nav(o.origin)} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-1.5 bg-white font-bold"><MapPinned className="size-4" aria-hidden />مسیر تا مبدأ</a><a href={nav(o.dest)} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-1.5 bg-white font-bold"><MapPinned className="size-4" aria-hidden />مسیر تا مقصد</a></div>
        </Card>
      )}
      {(o.status === "MISMATCH_REVIEW" || o.mismatchId) && <MismatchPanel o={o} role="driver" meId={me.id} />}
      {/* ───── stage panels ───── */}
      {o.status === "ASSIGNED" && (
        <Card className="space-y-3 p-4"><h2 className="font-extrabold">آماده‌ی حرکت به مبدأ</h2><p className="text-sm text-ink-3">بارگیری از {jDateTime(o.pickupAt)} تا {jDateTime(o.pickupTo)}.</p>
          <a href={nav(o.origin)} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-ui border border-line bg-white font-bold"><MapPinned className="size-5" aria-hidden />مسیریابی به مبدأ</a>
          <Button block size="lg" className="h-14" onClick={() => run(() => act((st) => startToPickup(st, me.id, o.id)), "حرکت ثبت شد.")}>شروع حرکت به مبدأ</Button></Card>
      )}
      {o.status === "EN_ROUTE_TO_PICKUP" && (
        <Card className="space-y-3 p-4"><h2 className="font-extrabold">در راه مبدأ</h2><a href={nav(o.origin)} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-ui border border-line bg-white font-bold"><MapPinned className="size-5" aria-hidden />مسیریابی</a>
          <Button block size="lg" className="h-14" onClick={() => run(() => act((st) => arrivePickup(st, me.id, o.id)), "رسیدن به مبدأ ثبت شد.")}>به مبدأ رسیدم</Button></Card>
      )}
      {o.status === "AT_PICKUP" && (
        <Card className="space-y-4 p-4">
          <h2 className="font-extrabold">بارگیری</h2>
          <div className="flex items-center justify-between rounded-ui bg-surface-2 p-3 text-sm"><span className="flex items-center gap-2"><Clock className="size-4" aria-hidden />زمان انتظار</span><span className={`font-black tabular ${wait > freeMs ? "text-danger" : ""}`}>{mmss(wait)}</span></div>
          <p className="text-xs text-ink-3">{fa(cv<number>(s, "waiting.freeMin"))} دقیقه‌ی اول رایگان است؛ پس از آن هزینه‌ی انتظار{wait > freeMs ? ` (فعلاً ${toman(waitFeeFor(s, o.arrivedPickupAt, now))})` : ""} به صاحب بار ثبت می‌شود.</p>
          <div className="grid grid-cols-2 gap-3"><FileDrop label="عکس بار" hint="با زمان و موقعیت" stamp capture value={cargo?.dataUrl} onChange={setCargo} /><FileDrop label="فاکتور بارگیری" stamp capture value={inv?.dataUrl} onChange={setInv} /></div>
          <Field label="تعداد اقلام روی فاکتور" hint="برای تطبیق با فاکتور تحویل">{(id) => <NumInput id={id} value={items} onChange={setItems} />}</Field>
          <Button block size="lg" className="h-14" loading={busy} disabled={!cargo || !inv} onClick={() => submit({ kind: "startTrip", driverId: me.id, orderId: o.id, cargo: asMedia(cargo!, "cargo"), invoice: asMedia(inv!, "invoice_pickup", items), items }, "بارگیری ثبت شد؛ سفر آغاز شد.")}>بارگیری شد؛ شروع سفر</Button>
          <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setMm(true)}>گزارش مغایرت بار</Button><Button variant="danger" onClick={() => run(() => act((st) => reportShipperNotReady(st, me.id, o.id)), "گزارش ثبت شد.")}>صاحب بار آماده نیست</Button></div>
        </Card>
      )}
      {(o.status === "IN_TRANSIT" || o.status === "AT_DELIVERY") && tel && pos && (
        <>
          <Card className="overflow-hidden"><MapView className="h-52" markers={[{ id: "o", lat: o.origin.lat, lng: o.origin.lng, kind: "origin" }, { id: "d", lat: o.dest.lat, lng: o.dest.lng, kind: "dest" }, { id: "t", lat: pos.lat, lng: pos.lng, kind: "truck" }]} lines={[{ id: "l", points: [[o.origin.lat, o.origin.lng], [o.dest.lat, o.dest.lng]], dashed: true, tone: "accent" }]} fitKey={o.id} /></Card>
          {cv<boolean>(s, "feature.telemetry") && o.tempMin !== undefined && o.tempMax !== undefined && <TempPanel o={{ ...tel, tempMin: o.tempMin, tempMax: o.tempMax, status: o.status }} />}
        </>
      )}
      {o.status === "IN_TRANSIT" && (
        <Card className="space-y-3 p-4"><a href={nav(o.dest)} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-ui border border-line bg-white font-bold"><MapPinned className="size-5" aria-hidden />مسیریابی به مقصد</a>
          <Button block size="lg" className="h-14" onClick={() => run(() => act((st) => arriveDelivery(st, me.id, o.id)), "رسیدن به مقصد ثبت شد.")}>به مقصد رسیدم</Button></Card>
      )}
      {o.status === "AT_DELIVERY" && (
        <Card className="space-y-4 p-4">
          <h2 className="font-extrabold">تحویل به گیرنده</h2>
          <Field label="کد تحویل گیرنده" hint="گیرنده کد ۴ رقمی را از پیامک می‌خواند.">{(id) => <Input id={id} dir="ltr" inputMode="numeric" maxLength={4} className="text-center text-2xl tracking-[0.6em]" value={otp} onChange={(e) => setOtp(e.target.value)} />}</Field>
          <FileDrop label="عکس فاکتور تحویل" stamp capture value={inv?.dataUrl} onChange={setInv} />
          <Field label="تعداد اقلام تحویل‌شده">{(id) => <NumInput id={id} value={items} onChange={setItems} />}</Field>
          {o.cashAgreed > 0 && <Field label="مبلغ نقدی دریافتی از گیرنده (تومان)" hint={`مبلغ توافقی ${toman(o.cashAgreed)}؛ مبلغ واقعی را وارد کنید.`}>{(id) => <NumInput id={id} value={cash} onChange={setCash} suffix="تومان" />}</Field>}
          <Button block size="lg" className="h-14" loading={busy} disabled={otp.length < 4 || !inv || (o.cashAgreed > 0 && cash === undefined)} onClick={() => submit({ kind: "deliver", driverId: me.id, orderId: o.id, otp, invoice: asMedia(inv!, "invoice_delivery", items), items, cashReceived: cash !== undefined ? R(cash) : undefined }, "تحویل ثبت شد؛ درآمد شما در انتظار آزادسازی است.")}>ثبت تحویل</Button>
        </Card>
      )}
      {["DELIVERED", "COMPLETED"].includes(o.status) && (
        <Card className="space-y-3 p-4"><h2 className="flex items-center gap-2 font-extrabold text-ok"><CheckCircle2 className="size-5" aria-hidden />سفر تحویل شد</h2>
          {o.settlement ? <p className="text-sm leading-7">درآمد {toman(o.settlement.driverNet)} {o.settlement.released ? "به کیف پول شما منتقل شد." : `پس از پنجره‌ی اعتراض (${jDateTime(o.settlement.releaseAt)}) قابل برداشت می‌شود.`}{o.settlement.held ? " (فعلاً به دلیل بررسی نگه داشته شده)" : ""}</p> : <p className="text-sm text-ink-3">تسویه پس از پرداخت مابقی توسط صاحب بار انجام می‌شود.</p>}
          {!myReview(s, me.id, o.id) ? <ReviewForm personId={me.id} orderId={o.id} role="driver" /> : <p className="text-sm text-ok">نظر شما ثبت شده است.</p>}</Card>
      )}

      {o.waybills.length > 0 && <Link href={`/waybill/?id=${o.id}`} className="flex h-12 items-center justify-center rounded-ui border-2 border-ink font-extrabold">بارنامه‌ی سفر (نسخه‌ی {fa(o.waybills.length)})</Link>}
      <Accordion title="درآمد این سفر"><dl className="space-y-1.5 text-sm"><div className="flex justify-between"><dt className="text-ink-3">کرایه</dt><dd className="font-bold tabular">{toman(o.freight)}</dd></div><div className="flex justify-between"><dt className="text-ink-3">کارمزد ({fa(Math.round(commissionRate(s, o) * 100))}٪)</dt><dd className="font-bold tabular text-danger">−{toman(net.commission)}</dd></div><div className="flex justify-between border-t border-line pt-2 font-black"><dt>خالص</dt><dd className="tabular text-ok">{toman(net.net)}</dd></div></dl></Accordion>
      <Accordion title="روند سفر"><StatusTimeline o={o} /></Accordion>
      <PriceBreakdownHidden />
      {["ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP"].includes(o.status) && <Button variant="danger" block onClick={() => setCancel(true)}>انصراف از سفر</Button>}

      <Sheet open={cancel} onClose={() => setCancel(false)} title="انصراف از سفر" footer={<div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setCancel(false)}>ادامه‌ی سفر</Button><Button variant="danger" onClick={() => { const r = run(() => act((st) => cancelByDriver(st, me.id, o.id, "انصراف راننده")), "سفر لغو شد."); if (r.ok) setCancel(false); }}>تأیید انصراف</Button></div>}>
        <p className="text-sm leading-7">با انصراف، مبلغ پرداختی به صاحب بار کامل برمی‌گردد و برای شما <b>امتیاز منفی</b> ثبت می‌شود. تکرار آن می‌تواند به تعلیق حساب منجر شود. اگر مشکل واقعی (خرابی، تصادف) دارید، ابتدا از SOS گزارش دهید.</p>
      </Sheet>
      <MismatchSheet open={mm} onClose={() => setMm(false)} o={o} driverId={me.id} />
      <SosSheet open={sos} onClose={() => setSos(false)} pid={me.id} orderId={o.id} />
    </div>
  );
}
const PriceBreakdownHidden = () => null;
void PriceBreakdown;

function SosSheet({ open, onClose, pid, orderId }: { open: boolean; onClose: () => void; pid: string; orderId: string }) {
  const [t, setT] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="کمک فوری">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2"><a href="tel:110" className="flex h-14 items-center justify-center gap-2 rounded-ui bg-danger font-black text-white"><Phone className="size-5" aria-hidden />پلیس ۱۱۰</a><a href="tel:115" className="flex h-14 items-center justify-center gap-2 rounded-ui bg-danger font-black text-white"><Phone className="size-5" aria-hidden />اورژانس ۱۱۵</a></div>
        <Field label="گزارش حادثه یا مشکل برای پشتیبانی سفر">{(id) => <Textarea id={id} value={t} onChange={(e) => setT(e.target.value)} placeholder="خرابی، تصادف، تأخیر، مشکل با گیرنده…" />}</Field>
        <Button block disabled={t.trim().length < 5} onClick={() => { const r = act((s) => openTicket(s, pid, "driver", { channel: "trip", category: "حادثه یا SOS", subject: "گزارش فوری راننده", text: t, orderId })); toast(r.ok ? "گزارش برای پشتیبانی سفر ارسال شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) { setT(""); onClose(); } }}><LifeBuoy className="size-5" aria-hidden />ارسال گزارش</Button>
      </div>
    </Sheet>
  );
}
