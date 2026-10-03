"use client";

import { AlertTriangle, CheckCircle2, Copy, Heart, Link2, MapPin, Phone, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TruckIllustration } from "@/components/graphics/TruckIllustration";
import { MapView } from "@/components/MapView";
import { CargoLabel, Countdown, RouteLine, StatusBadge, TempChip } from "@/components/molecules";
import { ModeChip, OdorChip, PriceBreakdown, StatusTimeline } from "@/components/order/parts";
import { PaymentSheet } from "@/components/order/PaymentSheet";
import { ReviewForm } from "@/components/ReviewForm";
import { TempPanel } from "@/components/TempPanel";
import { toast } from "@/components/Toaster";
import { Accordion, Button, Card, EmptyState, Field, Input, Sheet, Skeleton } from "@/components/ui";
import { addBoost, cancelByShipper, directFallback, payPostTip } from "@/lib/engine/orders";
import { cancelQuote, outstanding, shipperPaid } from "@/lib/engine/pay";
import { driverStats } from "@/lib/engine/stats";
import { myReview } from "@/lib/engine/trust";
import { person, shipperOf } from "@/lib/engine/core";
import { fa, jDateTime, mmss, PAY_TERMS, toman, weightLabel, tempRange } from "@/lib/format";
import { lerp } from "@/lib/geo";
import { useNow, usePortal, useQueryId } from "@/lib/hooks";
import { R } from "@/lib/money";
import { act } from "@/lib/store";
import { telemetryOf, tripProgress } from "@/lib/telemetry";
import { VEHICLES } from "@/lib/vehicles";
import type { Order } from "@/lib/types";

export default function Page() {
  const id = useQueryId();
  const { s, me, shipper } = usePortal("shipper");
  const o = s.orders.find((x) => x.id === id && x.shipperId === me?.id);
  if (id === undefined || !s.ready) return <div className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64" /></div>;
  if (!o || !me) return <EmptyState icon={<AlertTriangle className="size-8" />} title="سفارش پیدا نشد" body="این سفارش وجود ندارد یا به حساب شما تعلق ندارد." action={<Link href="/app/" className="font-bold text-accent-600">بازگشت به داشبورد</Link>} />;
  return <Detail o={o} meId={me.id} fav={shipper?.favorites ?? []} />;
}

function Detail({ o, meId, fav }: { o: Order; meId: string; fav: string[] }) {
  const { s } = usePortal("shipper");
  const now = useNow(1000);
  const [payOpen, setPayOpen] = useState<null | "deposit" | "balance" | "tip">(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const driver = o.driverId ? person(s, o.driverId) : undefined;
  const dp = o.driverId ? s.drivers.find((d) => d.personId === o.driverId) : undefined;
  const group = s.orders.filter((x) => x.groupId === o.groupId && x.id !== o.id);
  const showDriver = !!driver && o.assignedAt;
  const depDue = o.status === "AWAITING_DEPOSIT" ? Math.max(0, o.depositRequired - shipperPaid(o)) : 0;
  const bal = outstanding(o);
  const tel = telemetryOf(o);
  const transit = ["IN_TRANSIT", "AT_DELIVERY", "DELIVERED", "COMPLETED"].includes(o.status) && !!o.loadedAt;
  const pos = useMemo(() => lerp(o.origin, o.dest, tripProgress(tel, now)), [o, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancellable = !["IN_TRANSIT", "AT_DELIVERY", "DELIVERED", "COMPLETED", "DISPUTED", "EXPIRED"].includes(o.status) && !o.status.startsWith("CANCELLED");
  const reviewed = myReview(s, meId, o.id);
  const isFav = !!o.driverId && fav.includes(o.driverId);
  const link = typeof window !== "undefined" ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/track/?t=${o.consignee.token}` : "";

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href="/app/" className="inline-flex h-11 items-center text-sm font-medium text-accent-600">بازگشت به داشبورد</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-2xl font-black">{o.origin.city} ← {o.dest.city}</h1><div className="mt-1 text-sm text-ink-3"><CargoLabel type={o.cargo} /> · {weightLabel(o.weightKg)} · {VEHICLES[o.vehicleKind].short}</div></div>
          <div className="flex flex-wrap items-center gap-2"><ModeChip o={o} /><StatusBadge status={o.status} /></div>
        </div>
      </div>

      {/* ───── status-aware action panel ───── */}
      {(o.status === "OPEN" || o.status === "PRO_POOL") && (
        <Card className="space-y-3 border-2 border-brand-500 p-5"><h2 className="font-extrabold">{o.status === "PRO_POOL" ? "در انتظار راننده‌ی پرو" : "در انتظار راننده"}</h2><p className="text-sm leading-7 text-ink-3">بار هم‌اکنون برای رانندگان مناسب نمایش داده می‌شود. اگر دیر شد، با افزودن انعام جذب را سریع‌تر کنید.</p><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setBoostOpen(true)}><Zap className="size-4" aria-hidden />افزودن انعام جذب</Button></div></Card>
      )}
      {o.status === "DIRECT_REQUESTED" && <DirectPanel o={o} now={now} />}
      {o.status === "LOCKED" && o.lockedUntil && <Card className="space-y-3 p-5"><h2 className="font-extrabold">راننده در حال تأیید نهایی است</h2><Countdown until={o.lockedUntil} total={150} /></Card>}
      {o.status === "AWAITING_DEPOSIT" && (
        <Card className="space-y-3 border-2 border-brand-500 p-5">
          <h2 className="font-extrabold">راننده انتخاب شد؛ بیعانه را بپردازید</h2>
          {o.depositDueAt && <Countdown until={o.depositDueAt} total={600} />}
          <p className="text-sm leading-7 text-ink-3">پس از پرداخت، آدرس دقیق و مشخصات راننده باز و بارنامه صادر می‌شود. در صورت نپرداختن، سفارش دوباره برای رانندگان باز می‌شود.</p>
          <Button size="lg" block onClick={() => setPayOpen("deposit")}>پرداخت بیعانه · {toman(depDue)}</Button>
        </Card>
      )}
      {bal > 0 && o.assignedAt && !o.status.startsWith("CANCELLED") && o.status !== "AWAITING_DEPOSIT" && ["DEPOSIT_BALANCE_BEFORE_LOADING", "PREPAID"].includes(o.terms) && ["ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP"].includes(o.status) && (
        <Card className="space-y-3 border-2 border-warn p-5"><h2 className="font-extrabold">پرداخت مابقی پیش از بارگیری</h2><p className="text-sm text-ink-3">راننده تا پرداخت مابقی نمی‌تواند بارگیری را آغاز کند.</p><Button block onClick={() => setPayOpen("balance")}>پرداخت {toman(bal)}</Button></Card>
      )}
      {bal > 0 && ["DELIVERED"].includes(o.status) && (
        <Card className="space-y-3 border-2 border-warn p-5"><h2 className="font-extrabold">مابقی کرایه</h2><p className="text-sm text-ink-3">بار تحویل شد. پرداخت مابقی، تسویه را کامل می‌کند.</p><Button block onClick={() => setPayOpen("balance")}>پرداخت {toman(bal)}</Button></Card>
      )}
      {o.status === "MISMATCH_REVIEW" && <Card className="space-y-2 border-2 border-warn p-5"><h2 className="font-extrabold">مغایرت بار گزارش شد</h2><p className="text-sm text-ink-3">راننده مغایرتی میان بار واقعی و اظهار شما ثبت کرده است. بررسی و پاسخ در بخش مغایرت (به‌زودی در این صفحه).</p></Card>}

      {/* ───── live tracking ───── */}
      {transit && (
        <Card className="overflow-hidden">
          <MapView className="h-64" markers={[{ id: "o", lat: o.origin.lat, lng: o.origin.lng, kind: "origin" }, { id: "d", lat: o.dest.lat, lng: o.dest.lng, kind: "dest" }, { id: "t", lat: pos.lat, lng: pos.lng, kind: "truck" }]} lines={[{ id: "l", points: [[o.origin.lat, o.origin.lng], [o.dest.lat, o.dest.lng]], dashed: true, tone: "accent" }]} fitKey={o.id} />
          <div className="flex items-center justify-between gap-3 p-4 text-sm"><span className="flex items-center gap-1.5 font-bold"><MapPin className="size-4" aria-hidden />پیشرفت مسیر {fa(Math.round(tripProgress(tel, now) * 100))}٪</span><span className="text-xs text-ink-3">موقعیت شبیه‌سازی‌شده است</span></div>
        </Card>
      )}
      {transit && o.tempMin !== undefined && o.tempMax !== undefined && <TempPanel o={{ ...tel, tempMin: o.tempMin, tempMax: o.tempMax, status: o.status }} contact={driver ? { name: driver.name, phone: driver.phone } : undefined} />}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          {showDriver && driver && dp && (
            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between"><h2 className="font-extrabold">راننده</h2>
                <button onClick={() => act((st) => { const sh = shipperOf(st, meId); if (!sh || !o.driverId) return; sh.favorites = isFav ? sh.favorites.filter((x) => x !== o.driverId) : [...sh.favorites, o.driverId]; })} aria-pressed={isFav} aria-label={isFav ? "حذف از راننده‌های محبوب" : "افزودن به راننده‌های محبوب"} className="grid size-11 place-items-center rounded-full hover:bg-surface-3"><Heart className={isFav ? "size-5 fill-danger text-danger" : "size-5"} /></button></div>
              <TruckIllustration kind={dp.vehicle.kind} color={dp.vehicle.color} state={o.status === "IN_TRANSIT" ? "driving" : "idle"} className="h-20 w-full" label="خودروی راننده" />
              <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-black">{driver.name}</div><div className="text-sm text-ink-3">{VEHICLES[dp.vehicle.kind].short} · {fa(Math.round(driverStats(s, dp.personId).rating * 10) / 10)} از ۵</div></div>
                <a href={`tel:${driver.phone}`} className="inline-flex h-11 items-center gap-2 rounded-ui bg-surface-3 px-4 font-bold"><Phone className="size-4" aria-hidden /><span dir="ltr">{driver.phone}</span></a></div>
              {dp.vehicle.plate && <div className="text-sm text-ink-3">پلاک: <span className="font-bold text-ink">{dp.vehicle.plate.two} {dp.vehicle.plate.letter} {dp.vehicle.plate.three} · ایران {dp.vehicle.plate.prov}</span></div>}
            </Card>
          )}
          <Card className="space-y-3 p-5">
            <h2 className="font-extrabold">جزئیات بار و مسیر</h2>
            <RouteLine from={o.origin.city} to={o.dest.city} sub={[o.origin.address || "—", o.dest.address || "—"]} />
            <div className="flex flex-wrap gap-2">{o.tempMin !== undefined && o.tempMax !== undefined ? <TempChip min={o.tempMin} max={o.tempMax} /> : <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold">بدون کنترل دما</span>}<OdorChip odor={o.odor} sensitive={o.odorSensitive} /></div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[["بارگیری", jDateTime(o.pickupAt)], ["مهلت تحویل", jDateTime(o.deliverBy)], ["وزن", weightLabel(o.weightKg)], ["ارزش اعلامی", toman(o.declaredValue)], ["بسته‌بندی", o.packaging], ["شرایط پرداخت", PAY_TERMS[o.terms]], ["گیرنده", `${o.consignee.name}`], ["فاصله", `${fa(o.distanceKm)} کیلومتر`]].map(([k, v]) => <div key={k}><dt className="text-ink-3">{k}</dt><dd className="font-bold">{v}</dd></div>)}
            </dl>
            {o.tempMin !== undefined && o.tempMax !== undefined && <p className="text-xs text-ink-3">بازه‌ی مجاز دما: {tempRange(o.tempMin, o.tempMax)}</p>}
          </Card>
          {o.waybills.length > 0 && <Accordion title={`بارنامه (نسخه‌ی ${fa(o.waybills.length)})`}><WaybillList o={o} /></Accordion>}
          {group.length > 0 && <Card className="p-5"><h2 className="mb-2 font-extrabold">سایر خودروهای این سفارش</h2><ul className="divide-y divide-line">{group.map((g) => <li key={g.id}><Link href={`/app/order/?id=${g.id}`} className="flex min-h-12 items-center justify-between"><span className="text-sm font-medium">خودروی {fa(g.groupIndex)}</span><StatusBadge status={g.status} /></Link></li>)}</ul></Card>}
        </div>

        <div className="space-y-5">
          <Card className="p-5"><h2 className="mb-3 font-extrabold">روند سفارش</h2><StatusTimeline o={o} /></Card>
          <Card className="p-5"><h2 className="mb-3 font-extrabold">هزینه</h2><PriceBreakdown o={o} />
            {o.cancel && <div className="mt-3 rounded-ui bg-surface-2 p-3 text-sm"><div className="font-bold">لغو: {o.cancel.reason}</div><div className="text-ink-3">کارمزد لغو {toman(o.cancel.fee)} · بازگشت به شما {toman(o.cancel.refund)}</div></div>}</Card>

          {["DELIVERED", "COMPLETED"].includes(o.status) && o.driverId && (
            <Card className="space-y-3 p-5">
              <h2 className="font-extrabold">نظر شما</h2>
              {reviewed ? <p className="flex items-center gap-2 text-sm text-ok"><CheckCircle2 className="size-4" aria-hidden />نظر شما ثبت شده است.</p> : <ReviewForm personId={meId} orderId={o.id} role="shipper" />}
              <Button variant="secondary" block onClick={() => setPayOpen("tip")}>انعام به راننده</Button>
            </Card>
          )}

          {o.assignedAt && (
            <Card className="space-y-2 p-5">
              <h2 className="font-extrabold">رهگیری برای گیرنده</h2>
              <p className="text-sm leading-7 text-ink-3">این پیوند را برای گیرنده بفرستید؛ بدون نیاز به ورود، مسیر و دمای بار را می‌بیند. کد تحویل جداگانه به او پیامک می‌شود.</p>
              <div className="flex gap-2"><Input readOnly dir="ltr" value={link} aria-label="پیوند رهگیری" className="text-xs" /><Button variant="secondary" aria-label="کپی پیوند" onClick={() => { navigator.clipboard?.writeText(link); toast("پیوند کپی شد.", "info"); }}><Copy className="size-4" /></Button></div>
              <Link href={`/track/?t=${o.consignee.token}`} className="inline-flex h-11 items-center gap-1.5 text-sm font-bold text-accent-600"><Link2 className="size-4" aria-hidden />مشاهده‌ی صفحه‌ی گیرنده</Link>
            </Card>
          )}
          <Link href={`/app/new/?from=${o.id}`} className="flex h-12 items-center justify-center rounded-ui border border-line bg-white font-bold hover:bg-surface-3">سفارش مجدد با همین مشخصات</Link>
          {cancellable && <Button variant="danger" block onClick={() => setCancelOpen(true)}>لغو سفارش</Button>}
        </div>
      </div>

      <PaymentSheet open={payOpen === "deposit" || payOpen === "balance"} onClose={() => setPayOpen(null)} payerId={meId} orderId={o.id} purpose={payOpen === "deposit" ? "deposit" : "balance"} amount={payOpen === "deposit" ? depDue : bal} title={payOpen === "deposit" ? "پرداخت بیعانه" : "پرداخت مابقی کرایه"} />
      <TipSheet open={payOpen === "tip"} onClose={() => setPayOpen(null)} meId={meId} o={o} />
      <BoostSheet open={boostOpen} onClose={() => setBoostOpen(false)} meId={meId} o={o} />
      <CancelSheet open={cancelOpen} onClose={() => setCancelOpen(false)} o={o} meId={meId} />
    </div>
  );
}

function DirectPanel({ o, now }: { o: Order; now: number }) {
  const { s, me } = usePortal("shipper");
  const exp = (o.directExpiresAt ?? 0) < now;
  const d = person(s, o.directDriverId);
  const pros = s.drivers.filter((x) => x.pro.status === "pro" && x.personId !== me?.id && x.personId !== o.directDriverId).slice(0, 3);
  const run = (choice: "another" | "pro_pool" | "open", id?: string) => { const r = act((st) => directFallback(st, me!.id, o.id, choice, id)); toast(r.ok ? "انجام شد." : r.error, r.ok ? "ok" : "err"); };
  return (
    <Card className="space-y-3 border-2 border-brand-500 p-5">
      <h2 className="font-extrabold">{exp ? "راننده پاسخ نداد" : `درخواست برای ${d?.name ?? "راننده"} ارسال شد`}</h2>
      {!exp && o.directExpiresAt && <Countdown until={o.directExpiresAt} total={600} />}
      {exp && (
        <div className="space-y-2"><p className="text-sm text-ink-3">یکی از گزینه‌ها را انتخاب کنید:</p>
          {pros.map((p) => <Button key={p.personId} variant="secondary" block onClick={() => run("another", p.personId)}>درخواست از {person(s, p.personId)?.name}</Button>)}
          <Button variant="secondary" block onClick={() => run("pro_pool")}>ارسال به استخر پرو</Button><Button variant="secondary" block onClick={() => run("open")}>انتشار در بازار باز (سرویس استاندارد)</Button></div>
      )}
    </Card>
  );
}

function WaybillList({ o }: { o: Order }) {
  return (
    <ol className="space-y-3">
      {[...o.waybills].reverse().map((w, i, arr) => {
        const prev = arr[i + 1];
        const diffs = prev ? ([["وزن", w.weightKg !== prev.weightKg, `${weightLabel(prev.weightKg)} ← ${weightLabel(w.weightKg)}`], ["کرایه", w.freight !== prev.freight, `${toman(prev.freight)} ← ${toman(w.freight)}`], ["ارزش", w.declaredValue !== prev.declaredValue, `${toman(prev.declaredValue)} ← ${toman(w.declaredValue)}`]] as const).filter((x) => x[1]) : [];
        return (
          <li key={w.v} className={w.supersededAt ? "opacity-60" : ""}>
            <div className="flex items-center justify-between"><span className="font-bold">نسخه‌ی {fa(w.v)}{!w.supersededAt && " (جاری)"}</span><span className="text-xs text-ink-3">{jDateTime(w.at)}</span></div>
            <div className="text-sm text-ink-3">{w.reason} · {weightLabel(w.weightKg)} · {toman(w.freight)}</div>
            {diffs.map((d) => <div key={d[0]} className="text-sm font-medium text-warn">تغییر {d[0]}: {d[2]}</div>)}
            <Link href={`/waybill/?id=${o.id}&v=${w.v}`} className="inline-flex h-11 items-center text-sm font-bold text-accent-600">نمایش و چاپ</Link>
          </li>
        );
      })}
    </ol>
  );
}

function BoostSheet({ open, onClose, meId, o }: { open: boolean; onClose: () => void; meId: string; o: Order }) {
  const [v, setV] = useState(300_000);
  return (
    <Sheet open={open} onClose={onClose} title="انعام جذب سریع" footer={<Button block onClick={() => { const r = act((s) => addBoost(s, meId, o.id, R(v), "wallet")); toast(r.ok ? "انعام اضافه شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) onClose(); }}>افزودن {toman(R(v))}</Button>}>
      <div className="space-y-4"><p className="text-sm leading-7 text-ink-3">این مبلغ از کیف پول شما کسر می‌شود، به قیمت سفارش اضافه می‌شود و ۱۰۰٪ آن به راننده می‌رسد.</p>
        <div className="grid grid-cols-3 gap-2">{[200_000, 300_000, 500_000].map((x) => <button key={x} onClick={() => setV(x)} aria-pressed={v === x} className={`h-12 rounded-ui border-2 font-bold ${v === x ? "border-act bg-act-soft" : "border-line"}`}>{fa(x / 1000)} هزار</button>)}</div></div>
    </Sheet>
  );
}

function TipSheet({ open, onClose, meId, o }: { open: boolean; onClose: () => void; meId: string; o: Order }) {
  const [v, setV] = useState(300_000);
  return (
    <Sheet open={open} onClose={onClose} title="انعام به راننده" footer={<Button block onClick={() => { const r = act((s) => payPostTip(s, meId, o.id, R(v))); toast(r.ok ? "انعام پرداخت شد؛ سپاس از شما." : r.error, r.ok ? "ok" : "err"); if (r.ok) onClose(); }}>پرداخت {toman(R(v))}</Button>}>
      <div className="space-y-4"><p className="text-sm leading-7 text-ink-3">تا ۷۲ ساعت پس از تحویل می‌توانید انعام بدهید؛ مبلغ از کیف پول کسر و کامل به راننده پرداخت می‌شود.</p>
        <div className="grid grid-cols-3 gap-2">{[100_000, 300_000, 500_000].map((x) => <button key={x} onClick={() => setV(x)} aria-pressed={v === x} className={`h-12 rounded-ui border-2 font-bold ${v === x ? "border-act bg-act-soft" : "border-line"}`}>{fa(x / 1000)} هزار</button>)}</div>
        <Field label="مبلغ دلخواه (تومان)">{(id) => <Input id={id} dir="ltr" inputMode="numeric" value={v} onChange={(e) => setV(Number(e.target.value.replace(/\D/g, "")) || 0)} />}</Field></div>
    </Sheet>
  );
}

function CancelSheet({ open, onClose, o, meId }: { open: boolean; onClose: () => void; o: Order; meId: string }) {
  const { s } = usePortal("shipper");
  const q = cancelQuote(s, o, "shipper");
  const [reason, setReason] = useState("تغییر برنامه");
  return (
    <Sheet open={open} onClose={onClose} title="لغو سفارش" footer={<div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={onClose}>انصراف</Button><Button variant="danger" disabled={!q.allowed} onClick={() => { const r = act((st) => cancelByShipper(st, meId, o.id, reason)); toast(r.ok ? "سفارش لغو شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) onClose(); }}>تأیید لغو</Button></div>}>
      <div className="space-y-4">
        <div className="rounded-ui bg-surface-2 p-4"><div className="font-black">{q.title}</div>
          <dl className="mt-2 space-y-1.5 text-sm">{q.rows.map((r) => <div key={r.label} className="flex justify-between gap-3"><dt className="text-ink-3">{r.label}</dt><dd className="font-bold tabular">{toman(r.amount)}</dd></div>)}</dl></div>
        {q.fee > 0 && <p className="rounded-ui bg-warn-bg p-3 text-sm font-medium text-warn">با لغو، مبلغ {toman(q.fee)} به‌عنوان هزینه‌ی لغو کسر می‌شود.</p>}
        <Field label="دلیل لغو">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </div>
    </Sheet>
  );
}
